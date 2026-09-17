import { beforeEach, describe, expect, it } from 'vitest'
import translate, { loadLocaleSync, setLocaleSync, translateWithLocale } from './index'

describe('ubersetz core v2', () => {
  beforeEach(() => {
    setLocaleSync('en', {})
  })

  it('interpolates simple arguments', () => {
    setLocaleSync('en', {
      greeting: 'Hello {name}!',
    })

    expect(translate('greeting', { name: 'Max' }, 'fallback')).toBe('Hello Max!')
  })

  it('supports calling translate without params', () => {
    setLocaleSync('en', {
      greeting: 'Hello world!',
    })

    expect(translate('greeting', 'fallback')).toBe('Hello world!')
  })

  it('supports native messageformat plurals and selects', () => {
    setLocaleSync('en', {
      summary: '{gender, select, male {He} female {She} other {They}} bought {count, plural, one {# item} other {# items}}',
    })

    expect(translate('summary', { gender: 'male', count: 1 }, 'fallback')).toBe('He bought 1 item')
    expect(translate('summary', { gender: 'female', count: 2 }, 'fallback')).toBe('She bought 2 items')
  })

  it('keeps v1 plural compatibility for key_plural pairs', () => {
    setLocaleSync('en', {
      item_count: 'One item',
      item_count_plural: '{count} items',
    })

    expect(translate('item_count', { count: 1 }, 'fallback')).toBe('One item')
    expect(translate('item_count', { count: 2 }, 'fallback')).toBe('2 items')
  })

  it('compiles default values when a key is missing', () => {
    setLocaleSync('en', {})

    expect(translateWithLocale(
      'en',
      'missing',
      { count: 2 },
      '{count, plural, one {# file} other {# files}}',
    )).toBe('2 files')
  })

  it('supports translateWithLocale without params', () => {
    setLocaleSync('en', {})

    expect(translateWithLocale('en', 'missing', 'Fallback only')).toBe('Fallback only')
  })
})

describe('lazy compilation', () => {
  it('does not compile a phrase that nobody reads', () => {
    setLocaleSync('en', {
      read: 'Read me',
      unread: '{broken, plural, one {#}',
    })

    // An uncompilable phrase is only a problem once something asks for it,
    // which is what makes loading a large catalogue cheap.
    expect(translate('read', 'fallback')).toBe('Read me')
    expect(() => translate('unread', 'fallback')).toThrow()
  })

  it('compiles a phrase once and reuses the result', () => {
    setLocaleSync('en', { greeting: 'Hello {name}!' })

    expect(translate('greeting', { name: 'Ada' }, 'fallback')).toBe('Hello Ada!')
    expect(translate('greeting', { name: 'Max' }, 'fallback')).toBe('Hello Max!')
  })
})

describe('loading a locale in chunks', () => {
  it('merges phrases into the ones the locale already holds', () => {
    setLocaleSync('en', { greeting: 'Hello!' })
    loadLocaleSync('en', { farewell: 'Goodbye!' }, { merge: true })

    expect(translate('greeting', 'fallback')).toBe('Hello!')
    expect(translate('farewell', 'fallback')).toBe('Goodbye!')
  })

  it('replaces the phrases when merge is not asked for', () => {
    setLocaleSync('en', { greeting: 'Hello!' })
    loadLocaleSync('en', { farewell: 'Goodbye!' })

    expect(translate('greeting', 'fallback')).toBe('fallback')
    expect(translate('farewell', 'fallback')).toBe('Goodbye!')
  })

  it('lets a merged chunk replace a phrase that was already read', () => {
    setLocaleSync('en', { greeting: 'Hello!' })
    expect(translate('greeting', 'fallback')).toBe('Hello!')

    loadLocaleSync('en', { greeting: 'Hi!' }, { merge: true })
    expect(translate('greeting', 'fallback')).toBe('Hi!')
  })

  it('merges into a locale that has not been loaded yet', () => {
    loadLocaleSync('fresh', { greeting: 'Hello!' }, { merge: true })

    expect(translateWithLocale('fresh', 'greeting', 'fallback')).toBe('Hello!')
  })
})
