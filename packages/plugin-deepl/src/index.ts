// eslint-disable-next-line import/no-extraneous-dependencies
import { AutotranslationFunction } from '@ubersetz/cli/dist/types'
import deepl, { kill, setConcurrency } from 'deapl'
import { TargetLanguageCode, Translator } from 'deepl-node'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import preserveVariables from './preserveVariables'

let concurrency = 1
const queue = new PQueue({ concurrency })
type SourceLanguage = Parameters<typeof deepl>[1]['sourceLanguage']
type TargetLanguage = Parameters<typeof deepl>[1]['targetLanguage']

const sourceLanguages: SourceLanguage[] = [
  'bg',
  'zh',
  'cs',
  'da',
  'nl',
  'en',
  'et',
  'fi',
  'fr',
  'de',
  'el',
  'hu',
  'id',
  'it',
  'ja',
  'lv',
  'lt',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'es',
  'sv',
  'tr',
  'uk',
]
const targetLanguages: TargetLanguage[] = [
  'bg-BG',
  'zh-CN',
  'cs-CZ',
  'da-DK',
  'nl-NL',
  'en-US',
  'en-GB',
  'et-ET',
  'fi-FI',
  'fr-FR',
  'de-DE',
  'el-GR',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'lv-LV',
  'lt-LT',
  'pl-PL',
  'pt-PT',
  'pt-BR',
  'ro-RO',
  'ru-RU',
  'sk-SK',
  'sl-SL',
  'es-ES',
  'sv-SV',
  'tr-TR',
  'uk-UA',
]

function simplifyTargetLang(langCode: TargetLanguage): TargetLanguageCode {
  if (langCode === 'pt-PT') return langCode as TargetLanguageCode
  if (langCode === 'zh-CN') return 'zh'
  if (langCode === 'cs-CZ') return 'cs'
  if (langCode === 'da-DK') return 'da'
  if (langCode === 'el-GR') return 'el'
  if (langCode === 'ja-JP') return 'ja'
  if (langCode === 'uk-UA') return 'uk'

  const parts = langCode.split('-')
  if (parts.length === 1) return parts[0] as TargetLanguageCode
  if (parts[0].toLowerCase() === parts[1].toLowerCase()) return parts[0] as TargetLanguageCode
  return langCode as TargetLanguageCode
}

const translate: AutotranslationFunction = async (options) => {
  if (concurrency !== options.concurrency) {
    concurrency = options.concurrency
    queue.concurrency = concurrency
    setConcurrency(concurrency)
  }

  const sourceLanguage = options.sourceLanguage
    ? options.sourceLanguage.substr(0, 2).toLowerCase() as SourceLanguage
    : undefined
  if (sourceLanguage && !sourceLanguages.includes(sourceLanguage)) {
    throw new Error(`Invalid source language '${sourceLanguage}'. It must be one of these: ${sourceLanguages.join(', ')}`)
  }

  const targetLanguage = `${options.targetLanguage.substr(0, 2).toLowerCase()}-${options.targetLanguage.substr(3, 2).toUpperCase()}` as TargetLanguage
  if (!targetLanguages.includes(targetLanguage)) {
    throw new Error(`Invalid target language '${targetLanguage}'. It must be one of these: ${targetLanguages.join(', ')}`)
  }

  if (process.env.DEEPL_API_KEY) {
    const translator = new Translator(process.env.DEEPL_API_KEY)
    const result = await queue.add(() => translator.translateText(
      options.text,
      sourceLanguage || null,
      simplifyTargetLang(targetLanguage),
      options.informal == null ? {} : { formality: options.informal ? 'less' : 'more' },
    ))
    return {
      text: preserveVariables(options.text, result.text),
    }
  }

  return {
    text: await queue.add(async () => {
      const translated = await pRetry(() => deepl(options.text, {
        sourceLanguage,
        targetLanguage,
        formality: options.informal ? 'informal' : undefined,
        defaultDelay: 250,
      }), { retries: 5 })

      return preserveVariables(options.text, translated)
    }),
  }
}

translate.kill = () => kill()

export default translate
