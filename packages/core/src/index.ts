import MessageFormat from '@messageformat/core/lib/messageformat.js'

type PhraseMap = Record<string, string>
type ParameterValue = string | number | boolean | Date | null | undefined
type TranslationParameters = Record<string, ParameterValue> | undefined | null
type TranslateInput = TranslationParameters | string
type CompiledMessage = (parameters?: Record<string, ParameterValue>) => string

type CompiledPhraseMap = Record<string, CompiledMessage>
type LocaleChangeListener = (locale: string) => void

function getTranslationArguments(
  parametersOrDefaultValue: TranslateInput,
  defaultValue?: string,
): {
  parameters: TranslationParameters,
  defaultValue: string,
} {
  if (typeof parametersOrDefaultValue === 'string') {
    return {
      parameters: undefined,
      defaultValue: parametersOrDefaultValue,
    }
  }

  return {
    parameters: parametersOrDefaultValue,
    defaultValue: defaultValue || '',
  }
}

class LocaleManager {
  private locale: string | undefined

  private phraseCache: Record<string, PhraseMap> = {}

  private compiledCache: Record<string, CompiledPhraseMap> = {}

  private localeChangeListeners = new Set<LocaleChangeListener>()

  public getLocale() {
    return this.locale
  }

  public setLocaleSync(locale: string): void
  public setLocaleSync(locale: string, phrases: PhraseMap): void
  public setLocaleSync(
    locale: string,
    fileOrMessages?: PhraseMap,
  ) {
    if (fileOrMessages) {
      this.loadLocaleSync(locale, fileOrMessages)
    } else if (!this.phraseCache[locale]) {
      this.loadLocaleSync(locale, fileOrMessages)
    }
    this.locale = locale
    this.notifyLocaleChange(locale)
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
  }

  public loadLocaleSync(locale: string, fileOrMessages?: PhraseMap) {
    if (!fileOrMessages) {
      throw new Error(`Cannot load locale '${locale}' without filename or phrases provided`)
    }
    this.phraseCache[locale] = fileOrMessages
    this.compiledCache[locale] = this.compilePhraseMap(locale, fileOrMessages)
  }

  public async loadLocale(locale: string, fileOrMessages?: PhraseMap) {
    this.loadLocaleSync(locale, fileOrMessages)
  }

  public translate(key: string, defaultValue: string): string

  public translate(
    key: string,
    parameters: TranslationParameters,
    defaultValue: string,
  ): string

  public translate(
    key: string,
    parametersOrDefaultValue: TranslateInput,
    defaultValue?: string,
  ) {
    const locale = this.getLocale()
    if (!locale) {
      throw new Error('Locale not loaded')
    }

    const translationArguments = getTranslationArguments(parametersOrDefaultValue, defaultValue)
    return this.translateWithLocale(
      locale,
      key,
      translationArguments.parameters,
      translationArguments.defaultValue,
    )
  }

  public translateWithLocale(locale: string, key: string, defaultValue: string): string

  public translateWithLocale(
    locale: string,
    key: string,
    parameters: TranslationParameters,
    defaultValue: string,
  ): string

  public translateWithLocale(
    locale: string,
    key: string,
    parametersOrDefaultValue: TranslateInput,
    defaultValue?: string,
  ) {
    const translationArguments = getTranslationArguments(parametersOrDefaultValue, defaultValue)
    const phrases = this.phraseCache[locale]
    const compiledPhrases = this.compiledCache[locale]
    if (!phrases || !compiledPhrases) {
      throw new Error(`Locale '${locale}' not loaded`)
    }

    const pluralKey = `${key}_plural`
    const shouldUseV1Plural = translationArguments.parameters?.count != null
      && translationArguments.parameters.count !== 1
      && phrases[pluralKey] != null

    const compiled = shouldUseV1Plural
      ? compiledPhrases[pluralKey]
      : compiledPhrases[key]

    if (compiled) {
      return compiled(translationArguments.parameters ?? undefined)
    }

    const fallbackMessage = translationArguments.defaultValue || key
    return this.compileMessage(locale, fallbackMessage)(
      translationArguments.parameters ?? undefined,
    )
  }

  public onLocaleChange(listener: LocaleChangeListener) {
    this.localeChangeListeners.add(listener)
    return () => {
      this.localeChangeListeners.delete(listener)
    }
  }

  private notifyLocaleChange(locale: string) {
    for (const listener of this.localeChangeListeners) {
      listener(locale)
    }
  }

  private compilePhraseMap(locale: string, phrases: PhraseMap): CompiledPhraseMap {
    return Object.fromEntries(Object.entries(phrases).map(([key, value]) => [
      key,
      this.compileMessage(locale, value),
    ]))
  }

  private compileMessage(locale: string, value: string): CompiledMessage {
    const messageFormat = new MessageFormat(locale)
    return messageFormat.compile(value)
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
export const onLocaleChange = manager.onLocaleChange.bind(manager)
