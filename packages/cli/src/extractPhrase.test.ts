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

  it('extracts nested messageformat strings', () => {
    const content = "u('summary', { count, gender }, '{gender, select, male {He bought {count, plural, one {# item} other {# items}}} female {She bought {count, plural, one {# item} other {# items}}} other {They bought {count, plural, one {# item} other {# items}}}}')"

    expect(extractPhrase(content, config.getPatternRegExp('ts'))).toEqual([{
      key: 'summary',
      defaultValue: '{gender, select, male {He bought {count, plural, one {# item} other {# items}}} female {She bought {count, plural, one {# item} other {# items}}} other {They bought {count, plural, one {# item} other {# items}}}}',
    }])
  })
})
