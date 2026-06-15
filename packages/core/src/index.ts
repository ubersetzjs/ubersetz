import { EventEmitter } from 'events'

type PhraseMap = Record<string, string>
type TranslationParameters
  = Record<string, string | number | boolean | null | undefined> | undefined | null

class LocaleManager extends EventEmitter {
  private locale: string | undefined

  private phraseCache: Record<string, PhraseMap> = {}

  public getLocale() {
    return this.locale
  }

  public setLocaleSync(locale: string): void
  public setLocaleSync(locale: string, phrases: PhraseMap): void
  public setLocaleSync(
    locale: string,
    fileOrMessages?: PhraseMap,
  ) {
    if (!this.phraseCache[locale]) {
      this.loadLocaleSync(locale, fileOrMessages)
    }
    this.locale = locale
    this.emit('setLocale', locale)
  }

  public setLocale(locale: string): Promise<void>
  public setLocale(locale: string, phrases: PhraseMap): Promise<void>
  public async setLocale(
    locale: string,
    fileOrMessages?: PhraseMap,
  ): Promise<void> {
    if (fileOrMessages) {
      this.setLocaleSync(locale, fileOrMessages)
    } else {
      this.setLocaleSync(locale)
    }
    return
  }

  public loadLocaleSync(locale: string, fileOrMessages?: PhraseMap) {
    if (!fileOrMessages) {
      throw new Error(`Cannot load locale '${locale}' without filename or phrases provided`)
    }
    this.phraseCache[locale] = fileOrMessages
  }

  public async loadLocale(locale: string, fileOrMessages?: PhraseMap) {
    this.loadLocaleSync(locale, fileOrMessages)
    return
  }

  public translate(
    key: string,
    parameters: TranslationParameters,
    defaultValue: string,
  ) {
    const locale = this.getLocale()
    if (!locale) {
      throw new Error('Locale not loaded')
    }

    return this.translateWithLocale(locale, key, parameters, defaultValue)
  }

  public translateWithLocale(
    locale: string,
    key: string,
    parameters: TranslationParameters,
    defaultValue: string,
  ) {
    const phrases = this.phraseCache[locale]
    if (!phrases) {
      throw new Error(`Locale '${locale}' not loaded`)
    }

    let id = key
    if (parameters && parameters.count != null && parameters.count !== 1) {
      id = `${key}_plural`
      if (!phrases[id]) {
        id = key
      }
    }

    let value = phrases[id]
    if (!value) {
      value = defaultValue || key
    }

    if (parameters != null) {
      Object.keys(parameters).forEach((parameter) => {
        value = value.replaceAll(
          new RegExp(`{${parameter}}`, 'g'),
          parameters[parameter] == null ? '' : String(parameters[parameter]),
        )
      })
    }

    return value
  }
}

const manager = new LocaleManager()

const ubersetz = manager.translate.bind(manager)
export const translate = ubersetz
export default ubersetz

export const getLocale = manager.getLocale.bind(manager)
export const setLocale = manager.setLocale.bind(manager)
export const loadLocale = manager.loadLocale.bind(manager)
export const setLocaleSync = manager.setLocaleSync.bind(manager)
export const loadLocaleSync = manager.loadLocaleSync.bind(manager)
export const ubersetzWithLocale = manager.translateWithLocale.bind(manager)
export const translateWithLocale = ubersetzWithLocale
export const onLocaleChange = manager.on.bind(manager, 'setLocale')
