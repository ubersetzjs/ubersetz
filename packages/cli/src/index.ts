/* eslint-disable unicorn/no-process-exit */
import path from 'path'
import fs from 'fs/promises'
import type { ListrTask } from 'listr'
import Listr from 'listr'
import pMap from 'p-map'
import sortBy from 'lodash.sortby'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import findFiles from './utils/findFiles'
import config from './config'
import extractPhrase from './extractPhrase'
import type { CliOptions, Context, Phrase } from './types'
import canReadFile from './utils/canReadFile'
import getPhrasesFromFile from './utils/getPhrasesFromFile'
import getCountryFlag from './utils/getCountryFlag'
import getAutotranslationPlugin from './getAutotranslationPlugin'
import autotranslatePhrases from './autotranslatePhrases'
import writeLocale from './utils/writeLocale'
import sortObject from './utils/sortObject'
import { stringify } from './utils/json'
import migrateV1Phrases from './utils/migrateV1Phrases'
import { promptYesNo } from './utils/promptUser'

const defaultOptions: CliOptions = {
  '_': [process.cwd()],
  'autotranslation': true,
  'delete': true,
  'copy': true,
  'write': true,
  'fail': false,
  'autotranslate-parallel': true,
  'debug': false,
}

function getMigratedPhrases(phrases: Record<string, string>) {
  return migrateV1Phrases(phrases)
}

async function migrateLocaleFiles(dryRun: boolean) {
  const files = [
    config.getExtractionFilePath(),
    ...config.getLocales().map(locale => locale.file),
  ]
  const uniqueFiles = [...new Set(files)]
  let changedFiles = 0

  for (const file of uniqueFiles) {
    if (!await canReadFile(file)) {
      continue
    }

    const phrases = await getPhrasesFromFile(file)
    const migratedPhrases = getMigratedPhrases(phrases)
    const [currentContent, migratedContent] = await Promise.all([
      stringify(sortObject(phrases)),
      stringify(sortObject(migratedPhrases)),
    ])

    if (currentContent === migratedContent) {
      continue
    }

    changedFiles += 1
    if (!dryRun) {
      await writeLocale(file, migratedPhrases)
    }
  }

  /* eslint-disable no-console */
  console.log()
  console.log(`🧭  ${dryRun ? 'dry run:' : 'migrated:'} ${changedFiles} file(s)`)
  /* eslint-enable no-console */
}

async function invalidateChangedPhrases(
  changedKeys: string[],
  previousPhrases: Record<string, string>,
  extractedPhrases: Record<string, string>,
  write: boolean,
): Promise<number> {
  if (!write || changedKeys.length === 0) return 0

  const globalInvalidate = config.getInvalidateOnChange()
  const locales = config.getLocales()

  // Only phrases that existed before and now have a different default value
  const trulyChanged = changedKeys.filter(key => previousPhrases[key] != null)
  if (trulyChanged.length === 0) return 0

  let count = 0
  for (const key of trulyChanged) {
    const autoLocales = locales.filter(l => (l.invalidateOnChange ?? globalInvalidate) === true)
    const askLocales = locales.filter(l => (l.invalidateOnChange ?? globalInvalidate) == null)

    let invalidateAskLocales = false
    if (askLocales.length > 0 && process.stdout.isTTY) {
      const askPhrases = await Promise.all(
        askLocales.map(l => getPhrasesFromFile(l.file).then(getMigratedPhrases)),
      )
      const hasTranslation = askPhrases.some(phrases => phrases[key] != null)
      if (hasTranslation) {
        /* eslint-disable no-console */
        console.log()
        console.log(`✏️   '${key}' default changed:`)
        console.log(`     Old: "${previousPhrases[key]}"`)
        console.log(`     New: "${extractedPhrases[key]}"`)
        /* eslint-enable no-console */
        invalidateAskLocales = await promptYesNo('     Invalidate translations in all languages? (y/n) ')
      }
    }

    const localesToInvalidate = [
      ...autoLocales,
      ...(invalidateAskLocales ? askLocales : []),
    ]

    await Promise.all(localesToInvalidate.map(async (locale) => {
      const phrases = getMigratedPhrases(await getPhrasesFromFile(locale.file))
      if (phrases[key] == null) return
      const updated = { ...phrases }
      delete updated[key]
      await writeLocale(locale.file, updated)
      count++
    }))
  }
  return count
}

async function runExtraction(options: CliOptions) {
  const filePath = options._[0]
  const extractsFile = path.join(filePath, config.getExtractionFilePath())
  const previousPhrases: Record<string, string> = (await canReadFile(extractsFile))
    ? await getPhrasesFromFile(extractsFile)
    : {}

  const tasks = new Listr<Context>([{
    title: 'searching files',
    task: context => findFiles(filePath, {
      ignoreFiles: ['.gitignore', '.ubersetzignore'],
      pattern: new RegExp(config.getPatternExtensions().map(fileExtension => String.raw`\.${fileExtension}$`).join('|')),
    }).then((files) => {
      context.files = files
      context.phrases = []
      context.extractedPhrases = {}
      context.deletedPhrases = []
      context.newPhrases = []
      context.changedPhrases = []
      context.invalidatedCount = 0
      context.locales = []
    }),
  }, {
    title: 'extracting phrases from files',
    task: context => new Listr(config.getPatternExtensions().map<ListrTask<Context>>(extension => ({
      title: extension,
      task: async () => {
        const phrases: Phrase[] = []
        await pMap(context.files, async (name) => {
          if (!new RegExp(String.raw`\.${extension}$`).test(name)) return
          const fileContent = await fs.readFile(path.join(filePath, name), 'utf8')
          extractPhrase(fileContent, config.getPatternRegExp(extension))
            .forEach(phrase => phrases.push(phrase))
        })
        context.phrases = sortBy([...context.phrases || [], ...phrases], p => p.key.toLowerCase())
      },
    })), { concurrent: true }),
  }, {
    title: 'check phrases',
    skip: context => context.phrases.length <= 0,
    task: (context) => {
      context.extractedPhrases = context.phrases.reduce<Record<string, string>>((memo, phrase) => {
        if (memo[phrase.key] != null && memo[phrase.key] !== phrase.defaultValue) {
          throw new Error(`duplicate key '${phrase.key}', current: '${memo[phrase.key]}', new: '${phrase.defaultValue}'`)
        }

        return {
          ...memo,
          [phrase.key]: phrase.defaultValue,
        }
      }, {})
    },
  }, {
    title: 'write extractions file',
    skip: () => !options.write,
    task: async (context) => {
      if (await canReadFile(extractsFile)) {
        const currentPhrases = await getPhrasesFromFile(extractsFile)
        context.deletedPhrases = Object.keys(currentPhrases).filter(key =>
          context.extractedPhrases[key] == null)
        context.newPhrases = Object.keys(context.extractedPhrases).filter(key =>
          currentPhrases[key] == null)
        context.changedPhrases = Object.keys(context.extractedPhrases).filter(key =>
          currentPhrases[key] !== context.extractedPhrases[key])
      }
      await writeLocale(extractsFile, context.extractedPhrases)
    },
  }, {
    title: 'invalidating changed phrases',
    skip: context => !options.write || context.changedPhrases.length === 0,
    task: async (context) => {
      context.invalidatedCount = await invalidateChangedPhrases(
        context.changedPhrases,
        previousPhrases,
        context.extractedPhrases,
        options.write,
      )
    },
  }, {
    title: 'deleting old phrases',
    skip: () => !options.delete || config.getLocales().length <= 0,
    task: async (context) => {
      await Promise.all(config.getLocales().map(async (locale) => {
        const phrases = getMigratedPhrases(await getPhrasesFromFile(locale.file))
        const newPhrases = Object.keys(context.extractedPhrases)
          .reduce<Record<string, string>>((memo, key) => {
            if (!phrases[key]) return memo
            return {
              ...memo,
              [key]: phrases[key],
            }
          }, {})
        const [currentString, newString] = await Promise.all([
          stringify(sortObject(phrases)),
          stringify(sortObject(newPhrases)),
        ])
        if (currentString === newString) return
        await writeLocale(locale.file, newPhrases)
      }))
    },
  }, {
    title: 'copying new phrases to base locale',
    skip: () => !options.copy
      || !config.getLocales().some(i => i.base),
    task: async (context) => {
      const baseLocale = config.getLocales().find(i => i.base)
      if (!baseLocale) return
      const currentPhrases = await getPhrasesFromFile(baseLocale.file)
      const migratedPhrases = getMigratedPhrases(currentPhrases)
      const phraseEntries = Object.keys(context.extractedPhrases)
        .map((key) => {
          const hasLegacyPlural = currentPhrases[`${key}_plural`] != null
          return [
            key,
            hasLegacyPlural
              ? context.extractedPhrases[key]
              : migratedPhrases[key] || context.extractedPhrases[key],
          ]
        })
      const sortedPhrases = Object.fromEntries(phraseEntries) as Record<string, string>
      await writeLocale(baseLocale.file, sortedPhrases)
    },
  }, {
    title: 'checking existing phrases',
    skip: () => config.getLocales().length <= 0,
    task: async (context) => {
      context.locales = await pMap(config.getLocales(), async (locale) => {
        const phrases = getMigratedPhrases(await getPhrasesFromFile(locale.file))
        const translated: string[] = []
        const untranslated: string[] = []
        Object.keys(context.extractedPhrases).forEach((key) => {
          if (Object.keys(phrases).includes(key)) {
            translated.push(key)
          } else {
            untranslated.push(key)
          }
        })
        return { ...locale, phrases, translated, untranslated, autotranslated: [] }
      })
    },
  }, {
    title: 'automatically translate new phrases',
    skip: (context) => {
      if (!options.autotranslation) return true
      const autotranslationOptions = config.getAutotranslationOptions()
      if (!autotranslationOptions.plugin) return true
      return !context.locales.some(l => l.autotranslate && l.untranslated.length > 0)
    },
    task: async (context) => {
      const autotranslationOptions = config.getAutotranslationOptions()
      const autotranslateLocales = context.locales.filter(l => l.autotranslate)
      const autotranslate = await getAutotranslationPlugin(autotranslationOptions)

      return new Listr([{
        title: 'autotranslating',
        task: () => new Listr(autotranslateLocales.map(locale => ({
          title: `${getCountryFlag(locale.code)}   ${locale.name}`,
          task: () => autotranslatePhrases({
            locale,
            phrases: context.extractedPhrases,
            autotranslate,
            baseLocale: config.getBaseLocale(),
            concurrency: autotranslationOptions.concurrency || 10,
            throwOnError: options['debug'],
          }),
        })), { concurrent: options['autotranslate-parallel'] }),
      }, {
        title: 'cleaning up',
        task: () => {
          if (autotranslate.kill) {
            return autotranslate.kill()
          }
        },
      }])
    },
  }])
  const result = await tasks.run()
  const { newPhrases, changedPhrases, invalidatedCount } = result

  /* eslint-disable no-console */
  let shouldFail = result.deletedPhrases.length > 0
  console.log()
  console.log(`🆕  ${newPhrases.length} new phrases`)
  console.log(`✏️   ${changedPhrases.length} changed phrases`)
  console.log(`❌  ${result.deletedPhrases.length} deleted phrases`)
  if (invalidatedCount > 0) console.log(`🔄  ${invalidatedCount} invalidated phrases`)
  result.locales.forEach((locale) => {
    console.log()
    console.log(`${getCountryFlag(locale.code)}   ${locale.name}`)
    if (locale.untranslated.length > 0) {
      console.log(`\t🏳️   ${locale.untranslated.length} untranslated`)
      shouldFail = true
    }
    if (locale.autotranslated.length > 0) console.log(`\t🤖   ${locale.autotranslated.length} automatically translated`)
    if (locale.translated.length > 0) console.log(`\t🏴   ${locale.translated.length} already translated`)
  })
  /* eslint-enable no-console */

  if (options.fail && shouldFail) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

async function main() {
  const rawArguments = hideBin(process.argv)
  const [commandName] = rawArguments

  if (commandName === 'migrate') {
    const argv = yargs(rawArguments.slice(1))
      .option('dry-run', { type: 'boolean', default: false })
      .parseSync()
    await migrateLocaleFiles(Boolean(argv['dry-run']))
    process.exit(0)
  }

  const argv = yargs(rawArguments)
    .option('debug', { type: 'boolean', default: false, description: 'Crash immediately on any exception and display the full stack trace' })
    .parseSync()
  const options: CliOptions = {
    ...defaultOptions,
    ...argv,
    _: [typeof argv._[0] === 'string' ? argv._[0] : process.cwd()],
  }
  await runExtraction(options)
}

function formatError(error: unknown): string {
  const reset = '\u001B[0m'
  const red = '\u001B[31m'
  const bold = '\u001B[1m'
  const yellow = '\u001B[33m'

  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else {
    message = JSON.stringify(error)
  }

  return [
    '',
    `${red}${bold}\u2716  ubersetz:${reset} ${yellow}${message}${reset}`,
    '',
  ].join('\n')
}

function handleFatalError(error: unknown): never {
  // eslint-disable-next-line no-console
  console.error(formatError(error))
  process.exit(1)
}

process.on('unhandledRejection', (reason) => {
  handleFatalError(reason)
})

process.on('uncaughtException', (error) => {
  handleFatalError(error)
})

// eslint-disable-next-line unicorn/prefer-top-level-await
void (async () => {
  try {
    await main()
  } catch (error) {
    handleFatalError(error)
  }
})()
