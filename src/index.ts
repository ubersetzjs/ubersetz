import { EventEmitter } from 'events'

type PhraseMap = Record<string, string>
type TranslationParams = Record<string, unknown> | undefined | null

class LocaleManager extends EventEmitter {
  private locale: string | undefined

  private phraseCache: Record<string, PhraseMap> = {}

  public getLocale() {
    return this.locale
  }

  public setLocaleSync(locale: string): void // eslint-disable-next-line lines-between-class-members
  public setLocaleSync(locale: string, phrases: PhraseMap): void // eslint-disable-next-line lines-between-class-members
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

  public setLocale(locale: string): Promise<void> // eslint-disable-next-line lines-between-class-members
  public setLocale(locale: string, phrases: PhraseMap): Promise<void> // eslint-disable-next-line lines-between-class-members
  public async setLocale(
    locale: string,
    fileOrMessages?: PhraseMap,
  ): Promise<void> {
    if (fileOrMessages) {
      this.setLocaleSync(locale, fileOrMessages)
    } else {
      this.setLocaleSync(locale)
    }
    return Promise.resolve()
  }

  public loadLocaleSync(locale: string, fileOrMessages?: PhraseMap) {
    if (!fileOrMessages) {
      throw new Error(`Cannot load locale '${locale}' without filename or phrases provided`)
    }
    this.phraseCache[locale] = fileOrMessages
  }

  public async loadLocale(locale: string, fileOrMessages?: PhraseMap) {
    this.loadLocaleSync(locale, fileOrMessages)
    return Promise.resolve()
  }

  public translate(
    key: string,
    params: TranslationParams,
    defaultValue: string,
  ) {
    const locale = this.getLocale()
    if (!locale) {
      throw new Error('Locale not loaded')
    }

    return this.translateWithLocale(locale, key, params, defaultValue)
  }

  public translateWithLocale(
    locale: string,
    key: string,
    params: TranslationParams,
    defaultValue: string,
  ) {
    const phrases = this.phraseCache[locale]
    if (!phrases) {
      throw new Error(`Locale '${locale}' not loaded`)
    }

    let id = key
    if (params && params.count != null && params.count !== 1) {
      id = `${key}_plural`
      if (!phrases[id]) {
        id = key
      }
    }

    let value = phrases[id]
    if (!value) {
      value = defaultValue || key
    }

    if (params != null) {
      Object.keys(params).forEach((param) => {
        value = value.replace(
          new RegExp(`{${param}}`, 'g'),
          params[param] == null ? '' : String(params[param]),
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
