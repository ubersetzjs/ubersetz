function buildPluralMessage(singular: string, plural: string) {
  return `{count, plural, one {${singular}} other {${plural}}}`
}

export default function migrateV1Phrases(phrases: Record<string, string>) {
  const migrated: Record<string, string> = {}

  for (const [key, value] of Object.entries(phrases)) {
    if (key.endsWith('_plural')) {
      continue
    }

    const pluralValue = phrases[`${key}_plural`]
    migrated[key] = pluralValue == null ? value : buildPluralMessage(value, pluralValue)
  }

  for (const [key, value] of Object.entries(phrases)) {
    if (!key.endsWith('_plural')) {
      continue
    }

    const singularKey = key.slice(0, Math.max(0, key.length - '_plural'.length))
    if (phrases[singularKey] != null) {
      continue
    }

    migrated[key] = value
  }

  return migrated
}
