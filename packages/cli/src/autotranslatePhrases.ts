import pMap from 'p-map'
import { Observable } from 'rxjs'
import type { AutotranslationFunction, Context } from './types'
import addPhraseToFile from './utils/addPhraseToFile'
import translateMessageFormat from './utils/translateMessageFormat'

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
  const update = () => observer.next(`${count}/${untranslated.length} translated`)
  update()

  const promise = async () => {
    await pMap(untranslated, async (key) => {
      const phrase = phrases[key]
      if (!phrase) throw new Error(`Cannot find phrase for key '${key}'`)
      const text = await translateMessageFormat(phrase, async (input) => {
        const result = await autotranslate({
          informal,
          text: input,
          targetLanguage: locale.code,
          sourceLanguage: baseLocale,
          concurrency,
        })
        return result.text
      })

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
