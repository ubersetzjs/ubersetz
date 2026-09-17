import fs from 'fs/promises'
import type { Locale } from '../types'
import canReadFile from './canReadFile'
import getPhrasesFromFile from './getPhrasesFromFile'
import { stringify } from './json'
import sortObject from './sortObject'
import writeLocale from './writeLocale'

type ResolvedChunk = {
  file: string,
  match: RegExp,
}

// Keyed on the locale object rather than on its path: one split compiles its
// expressions once, and a caller that hands over a differently configured
// locale for the same file is not answered from a stale cache.
const compiledChunks = new WeakMap<Locale, ResolvedChunk[]>()

function resolveChunks(locale: Locale): ResolvedChunk[] {
  const cached = compiledChunks.get(locale)
  if (cached) return cached

  const chunks = (locale.chunks ?? []).map((chunk) => {
    if (chunk.file === locale.file) {
      throw new Error(`Chunk of locale '${locale.code}' must not write to the locale's own file '${chunk.file}'`)
    }
    try {
      return { file: chunk.file, match: new RegExp(chunk.match) }
    } catch {
      throw new Error(`Chunk '${chunk.file}' of locale '${locale.code}' has an invalid 'match' expression: ${chunk.match}`)
    }
  })

  const files = chunks.map(chunk => chunk.file)
  const duplicate = files.find((file, index) => files.indexOf(file) !== index)
  if (duplicate) {
    throw new Error(`Locale '${locale.code}' declares the chunk file '${duplicate}' twice`)
  }

  compiledChunks.set(locale, chunks)
  return chunks
}

/**
 * Every file a locale's phrases are spread over, the catch-all file last.
 */
export function getLocaleFiles(locale: Locale): string[] {
  return [...resolveChunks(locale).map(chunk => chunk.file), locale.file]
}

/**
 * The file a key belongs in. The first chunk whose expression matches claims
 * it; everything else goes to the locale's own file.
 */
export function getFileForKey(locale: Locale, key: string): string {
  return resolveChunks(locale).find(chunk => chunk.match.test(key))?.file ?? locale.file
}

/**
 * A locale's phrases as one map, whichever of its files they sit in. A key in
 * more than one file is read from the chunk that claims it.
 */
export async function readLocalePhrases(locale: Locale): Promise<Record<string, string>> {
  const files = getLocaleFiles(locale)
  const contents = await Promise.all(files.map(file => getPhrasesFromFile(file)))
  // Reversed, so the catch-all file cannot shadow a chunk that claims the key.
  return Object.assign({}, ...contents.toReversed()) as Record<string, string>
}

function splitPhrases(
  locale: Locale,
  phrases: Record<string, string>,
): Record<string, Record<string, string>> {
  const split: Record<string, Record<string, string>> = Object.fromEntries(
    getLocaleFiles(locale).map(file => [file, {}]),
  )
  for (const [key, value] of Object.entries(phrases)) {
    split[getFileForKey(locale, key)][key] = value
  }
  return split
}

/**
 * Writes a locale's phrases back across its files, each key in the file its
 * expression claims. A file whose content would not change is left alone, so a
 * run that splits nothing writes nothing — and a key whose chunk expression
 * changed moves files without ever being absent from the locale.
 */
export async function writeLocalePhrases(
  locale: Locale,
  phrases: Record<string, string>,
): Promise<void> {
  const split = splitPhrases(locale, phrases)
  await Promise.all(Object.entries(split).map(async ([file, filePhrases]) => {
    const nextContent = await stringify(sortObject(filePhrases), 2) + '\n'
    if (await canReadFile(file)) {
      const currentContent = await fs.readFile(file, 'utf8')
      if (currentContent === nextContent) return
    }
    await writeLocale(file, filePhrases)
  }))
}
