import pMap from 'p-map'
import { Observable } from 'rxjs'
import type { AutotranslationFunction, Context } from './types'
import addPhraseToFile from './utils/addPhraseToFile'
import translateMessageFormat from './utils/translateMessageFormat'

const MAX_RETRIES = 5
const BASE_DELAY_MS = 2000
const MAX_DELAY_MS = 60_000

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const autotranslatePhrases = ({
  locale,
  phrases,
  autotranslate,
  baseLocale,
  concurrency,
}: {
  locale: Context['locales'][0],
  phrases: Record<string, string>,
  autotranslate: AutotranslationFunction,
  baseLocale: string,
  concurrency: number,
}) => new Observable((observer) => {
  const { untranslated, informal } = locale
  let count = 0

  const update = (status?: string) => {
    const base = `${count}/${untranslated.length} translated`
    observer.next(status == null ? base : `${base} — ${status}`)
  }
  update()

  const promise = async () => {
    await pMap(untranslated, async (key) => {
      const phrase = phrases[key]
      if (!phrase) throw new Error(`Cannot find phrase for key '${key}'`)

      let text: string | undefined
      let attempt = 0

      while (text === undefined) {
        try {
          text = await translateMessageFormat(phrase, async (input) => {
            const result = await autotranslate({
              informal,
              text: input,
              targetLanguage: locale.code,
              sourceLanguage: baseLocale,
              concurrency,
            })
            return result.text
          })
        } catch (error) {
          attempt += 1
          if (attempt >= MAX_RETRIES) {
            const reason = error instanceof Error ? error.message : String(error)
            update(`⚠️  skipped '${key}' after ${MAX_RETRIES} attempts: ${reason}`)
            return
          }
          const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)
          const reason = error instanceof Error ? error.message : String(error)
          update(`⚠️  retrying '${key}' (attempt ${attempt}/${MAX_RETRIES}, waiting ${delay / 1000}s — ${reason})`)
          await sleep(delay)
        }
      }

      locale.untranslated = locale.untranslated.filter(i => i !== key)
      locale.translated.push(key)
      locale.autotranslated.push(key)
      count += 1
      update()
      await addPhraseToFile(locale.file, key, text)
    }, { concurrency })
  }
  promise()
    .then(() => observer.complete())
    .catch(error => observer.error(error))
})

export default autotranslatePhrases
