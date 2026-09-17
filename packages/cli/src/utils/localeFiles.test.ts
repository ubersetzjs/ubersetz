import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `json.ts` does its work in a worker thread that only exists in the built
// package; these tests are about which file a phrase lands in, not about how
// it is serialised.
vi.mock('./json', () => ({
  stringify: async (data: unknown, indent?: number) => JSON.stringify(data, null, indent),
  parse: async (data: string) => JSON.parse(data),
}))
import type { Locale } from '../types'
import { getFileForKey, getLocaleFiles, readLocalePhrases, writeLocalePhrases } from './localeFiles'

let directory: string

const makeLocale = (chunks?: Locale['chunks']): Locale => ({
  name: 'German',
  code: 'de-de',
  file: path.join(directory, 'de.json'),
  chunks: chunks?.map(chunk => ({ ...chunk, file: path.join(directory, chunk.file) })),
})

const read = async (file: string) =>
  JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')) as Record<string, string>

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ubersetz-locale-files-'))
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

describe('a locale without chunks', () => {
  it('reads and writes a single file', async () => {
    const locale = makeLocale()
    await writeLocalePhrases(locale, { greeting: 'Hallo!' })

    expect(getLocaleFiles(locale)).toEqual([locale.file])
    expect(await read('de.json')).toEqual({ greeting: 'Hallo!' })
    expect(await readLocalePhrases(locale)).toEqual({ greeting: 'Hallo!' })
  })
})

describe('a locale split into chunks', () => {
  const chunks = [{ file: 'de.facts.json', match: String.raw`^facts\.` }]

  it('writes each key to the file its expression claims', async () => {
    const locale = makeLocale(chunks)
    await writeLocalePhrases(locale, {
      'greeting': 'Hallo!',
      'facts.a320': 'Ein Schmalrumpfflugzeug.',
    })

    expect(await read('de.json')).toEqual({ greeting: 'Hallo!' })
    expect(await read('de.facts.json')).toEqual({ 'facts.a320': 'Ein Schmalrumpfflugzeug.' })
  })

  it('creates every declared file, even an empty one', async () => {
    const locale = makeLocale(chunks)
    await writeLocalePhrases(locale, { greeting: 'Hallo!' })

    expect(await read('de.facts.json')).toEqual({})
  })

  it('reads the files back as one map', async () => {
    const locale = makeLocale(chunks)
    await writeLocalePhrases(locale, { 'greeting': 'Hallo!', 'facts.a320': 'Ein Schmalrumpfflugzeug.' })

    expect(await readLocalePhrases(locale)).toEqual({
      'greeting': 'Hallo!',
      'facts.a320': 'Ein Schmalrumpfflugzeug.',
    })
  })

  it('names the file a key belongs in', () => {
    const locale = makeLocale(chunks)

    expect(getFileForKey(locale, 'facts.a320')).toBe(path.join(directory, 'de.facts.json'))
    expect(getFileForKey(locale, 'greeting')).toBe(locale.file)
  })

  it('moves a key without losing it when its expression changes', async () => {
    await writeLocalePhrases(makeLocale(chunks), {
      'greeting': 'Hallo!',
      'facts.a320': 'Ein Schmalrumpfflugzeug.',
    })

    const widened = makeLocale([{ file: 'de.facts.json', match: '^(?:facts|greeting)' }])
    await writeLocalePhrases(widened, await readLocalePhrases(widened))

    expect(await read('de.json')).toEqual({})
    expect(await read('de.facts.json')).toEqual({
      'greeting': 'Hallo!',
      'facts.a320': 'Ein Schmalrumpfflugzeug.',
    })
  })

  it('leaves a file alone whose content would not change', async () => {
    const locale = makeLocale(chunks)
    await writeLocalePhrases(locale, { 'greeting': 'Hallo!', 'facts.a320': 'Ein Schmalrumpfflugzeug.' })
    const written = await fs.stat(path.join(directory, 'de.facts.json'))

    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
    await writeLocalePhrases(locale, { 'greeting': 'Servus!', 'facts.a320': 'Ein Schmalrumpfflugzeug.' })

    const rewritten = await fs.stat(path.join(directory, 'de.facts.json'))
    expect(rewritten.mtimeMs).toBe(written.mtimeMs)
    expect(await read('de.json')).toEqual({ greeting: 'Servus!' })
  })

  it('refuses a chunk that writes to the locale file itself', () => {
    const locale: Locale = {
      name: 'German',
      code: 'de-de',
      file: path.join(directory, 'same.json'),
      chunks: [{ file: path.join(directory, 'same.json'), match: '^a' }],
    }

    expect(() => getLocaleFiles(locale)).toThrow(/must not write to the locale/)
  })

  it('refuses an invalid match expression', () => {
    const locale: Locale = {
      name: 'German',
      code: 'de-de',
      file: path.join(directory, 'broken.json'),
      chunks: [{ file: path.join(directory, 'broken.facts.json'), match: '^(' }],
    }

    expect(() => getLocaleFiles(locale)).toThrow(/invalid 'match' expression/)
  })
})
