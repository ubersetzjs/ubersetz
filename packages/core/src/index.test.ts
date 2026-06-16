import { beforeEach, describe, expect, it } from 'vitest'
import translate, { setLocaleSync, translateWithLocale } from './index'

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
})
