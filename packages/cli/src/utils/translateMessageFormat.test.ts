import { describe, expect, it } from 'vitest'
import translateMessageFormat from './translateMessageFormat'

describe('translateMessageFormat', () => {
  it('preserves messageformat structure while translating leaf text', async () => {
    const result = await translateMessageFormat(
      '{count, plural, one {One {name} item} other {{count, number} items}}',
      async text => text
        .replace('One', 'Ein')
        .replace('items', 'Artikel')
        .replace('item', 'Artikel'),
    )

    expect(result).toBe('{count, plural, one {Ein {name} Artikel} other {{count, number} Artikel}}')
  })

  it('falls back to translating the whole string when parsing fails', async () => {
    const result = await translateMessageFormat('{broken', async text => `${text}!`)
    expect(result).toBe('{broken!')
  })
})
