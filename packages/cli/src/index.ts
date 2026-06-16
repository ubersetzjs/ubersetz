#!/usr/bin/env node

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

const defaultOptions: CliOptions = {
  '_': [process.cwd()],
  'autotranslation': true,
  'delete': true,
  'copy': true,
  'write': true,
  'fail': false,
  'autotranslate-parallel': true,
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

async function runExtraction(options: CliOptions) {
  const filePath = options._[0]
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
      const extractsFile = path.join(filePath, config.getExtractionFilePath())
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
  const { newPhrases, changedPhrases } = result

  /* eslint-disable no-console */
  let shouldFail = result.deletedPhrases.length > 0
  console.log()
  console.log(`🆕  ${newPhrases.length} new phrases`)
  console.log(`✏️   ${changedPhrases.length} changed phrases`)
  console.log(`❌  ${result.deletedPhrases.length} deleted phrases`)
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

const rawArguments = hideBin(process.argv)
const [commandName] = rawArguments

try {
  if (commandName === 'migrate') {
    const argv = yargs(rawArguments.slice(1))
      .option('dry-run', { type: 'boolean', default: false })
      .parseSync()
    await migrateLocaleFiles(Boolean(argv['dry-run']))
    process.exit(0)
  }

  const argv = yargs(rawArguments).parseSync()
  const options: CliOptions = {
    ...defaultOptions,
    ...argv,
    _: [typeof argv._[0] === 'string' ? argv._[0] : process.cwd()],
  }
  await runExtraction(options)
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exit(1)
}
