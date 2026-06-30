import { describe, expect, it } from 'vitest'
import migrateV1Phrases from './migrateV1Phrases'

describe('migrateV1Phrases', () => {
  it('merges legacy plural pairs into a single messageformat string', () => {
    expect(migrateV1Phrases({
      item_count: 'One item',
      item_count_plural: '{count} items',
      greeting: 'Hello {name}!',
    })).toEqual({
      item_count: '{count, plural, one {One item} other {{count} items}}',
      greeting: 'Hello {name}!',
    })
  })

  it('keeps orphaned plural keys untouched', () => {
    expect(migrateV1Phrases({
      item_count_plural: '{count} items',
    })).toEqual({
      item_count_plural: '{count} items',
    })
  })
})
