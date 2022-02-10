import { EventEmitter } from 'events'

class LocaleManager extends EventEmitter {
  private locale: string | undefined

  private phraseCache: Record<string, Record<string, string>> = {}

  public getLocale() {
    return this.locale
  }

  public setLocaleSync(locale: string): void // eslint-disable-next-line lines-between-class-members
  public setLocaleSync(locale: string, phrases: Record<string, string>): void // eslint-disable-next-line lines-between-class-members
  public setLocaleSync(
    locale: string,
    fileOrMessages?: Record<string, string>,
  ) {
    if (!this.phraseCache[locale]) {
      this.loadLocaleSync(locale, fileOrMessages)
    }
    this.locale = locale
    this.emit('setLocale', locale)
  }

  public setLocale(locale: string): Promise<void> // eslint-disable-next-line lines-between-class-members
  public setLocale(locale: string, phrases: Record<string, string>): Promise<void> // eslint-disable-next-line lines-between-class-members
  public async setLocale(
    locale: string,
    fileOrMessages?: Record<string, string>,
  ): Promise<void> {
    this.setLocaleSync(locale, fileOrMessages as Record<string, string>)
    return Promise.resolve()
  }

  public async loadLocaleSync(locale: string, fileOrMessages?: Record<string, string>) {
    if (!fileOrMessages) {
      throw new Error(`Cannot load locale '${locale}' without filename or phrases provided`)
    }
    this.phraseCache[locale] = fileOrMessages
  }

  public async loadLocale(locale: string, fileOrMessages?: Record<string, string>) {
    this.loadLocaleSync(locale, fileOrMessages)
    return Promise.resolve()
  }

  public translate(
    key: string,
    params: Record<string, any> | undefined | null,
    defaultValue: string,
  ) {
    const locale = this.getLocale()
    if (!locale || !this.phraseCache[locale]) throw new Error('Locale not loaded')
    const phrases = this.phraseCache[locale]

    let id = key
    if (params && params.count != null && params.count !== 1) {
      id = `${key}_plural`
      if (!phrases[id]) id = key
    }

    let value = phrases[id]
    if (!value) {
      value = defaultValue || key
    }

    if (params != null) {
      Object.keys(params).forEach((param) => {
        value = value.replace(new RegExp(`{${param}}`, 'g'), params[param] == null ? '' : params[param])
      })
    }
    return value
  }
}

const manager = new LocaleManager()

const ubersetz = manager.translate.bind(manager)
export default ubersetz

export const getLocale = manager.getLocale.bind(manager)
export const setLocale = manager.setLocale.bind(manager)
export const loadLocale = manager.loadLocale.bind(manager)
export const setLocaleSync = manager.setLocaleSync.bind(manager)
export const loadLocaleSync = manager.loadLocaleSync.bind(manager)
export const onLocaleChange = manager.on.bind(manager, 'setLocale')
