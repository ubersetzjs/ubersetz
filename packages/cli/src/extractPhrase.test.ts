import { describe, expect, it } from 'vitest'
import config from './config'
import extractPhrase from './extractPhrase'

describe('extractPhrase', () => {
  it('keeps full messageformat strings intact', () => {
    const content = "u('item_count', { count }, '{count, plural, one {# item} other {# items}}')"

    expect(extractPhrase(content, config.getPatternRegExp('ts'))).toEqual([{
      key: 'item_count',
      defaultValue: '{count, plural, one {# item} other {# items}}',
    }])
  })

  it('extracts phrases when params are omitted', () => {
    const content = "u('greeting', 'Hello world!')"

    expect(extractPhrase(content, config.getPatternRegExp('ts'))).toEqual([{
      key: 'greeting',
      defaultValue: 'Hello world!',
    }])
  })

  it('extracts nested messageformat strings', () => {
    const content = "u('summary', { count, gender }, '{gender, select, male {He bought {count, plural, one {# item} other {# items}}} female {She bought {count, plural, one {# item} other {# items}}} other {They bought {count, plural, one {# item} other {# items}}}}')"

    expect(extractPhrase(content, config.getPatternRegExp('ts'))).toEqual([{
      key: 'summary',
      defaultValue: '{gender, select, male {He bought {count, plural, one {# item} other {# items}}} female {She bought {count, plural, one {# item} other {# items}}} other {They bought {count, plural, one {# item} other {# items}}}}',
    }])
  })

  it('extracts multiline u calls with template literals', () => {
    const content = `u(
  'welcome',
  {
    name,
    body: dedent\`
      Hello
      there
    \`,
  },
  \`
    Hello {name}!
    Welcome back.
  \`,
)`

    expect(extractPhrase(content, config.getPatternRegExp('ts'))).toEqual([{
      key: 'welcome',
      defaultValue: '\n    Hello {name}!\n    Welcome back.\n  ',
    }])
  })

  it('throws when a template literal with variable interpolation is used as phrase value', () => {
    const content = "u('greeting', `Hello ${name}`)"

    expect(() => extractPhrase(content, config.getPatternRegExp('ts'))).toThrow(
      'template literal with variable interpolation is not allowed as a phrase value',
    )
  })

  it('extracts multiline u calls with tagged template literals and omitted params', () => {
    const content = `u(
  'description',
  dedent\`
    First line
    Second line
  \`,
)`

    expect(extractPhrase(content, config.getPatternRegExp('ts'))).toEqual([{
      key: 'description',
      defaultValue: '\n    First line\n    Second line\n  ',
    }])
  })
})
