# ubersetz

Ubersetz is a lightweight i18n toolkit built around one simple idea:

- keep translations close to the code that uses them
- extract them automatically into locale files
- render them with full MessageFormat support at runtime

This repository is the **ubersetz monorepo**.

## Packages

- `ubersetz` — runtime translation API
- `@ubersetz/cli` — extraction, migration, locale maintenance, autotranslation workflow
- `ubersetz-plugin-deepl` — optional DeepL autotranslation plugin

## What it supports

- inline default messages in source code
- locale switching at runtime
- full MessageFormat syntax via `@messageformat/core`
- variable interpolation
- plural, select, and selectordinal
- number, date, and time formatting
- extraction into JSON locale files
- migration from legacy `key` + `key_plural` locale files
- optional autotranslation via plugins

## Quick start

### Install

```sh
npm install ubersetz
npm install -D @ubersetz/cli
```

Optional autotranslation plugin:

```sh
npm install -D ubersetz-plugin-deepl
```

### Configure

Create `.ubersetzrc` in your app:

```json
{
  "functionName": "u",
  "baseLocale": "en-us",
  "extractionFile": "locales/extracted.json",
  "locales": [
    {
      "name": "English (US)",
      "code": "en-us",
      "file": "locales/en-us.json"
    },
    {
      "name": "German",
      "code": "de-de",
      "file": "locales/de-de.json"
    }
  ]
}
```

`baseLocale` should match one of your locale `code` values exactly.

### Use it in code

```ts
import u from 'ubersetz'

u('greeting', 'Hello world!')
u('welcome', { name: 'Max' }, 'Hello {name}!')
u('item_count', { count: 2 }, '{count, plural, one {# item} other {# items}}')
```

### Load a locale

```ts
import { setLocale, getLocale } from 'ubersetz'
import enUs from './locales/en-us.json'

await setLocale('en-us', enUs)

console.log(getLocale())
```

### Extract phrases

```sh
npx @ubersetz/cli .
```

This scans your project, finds `u(...)` calls, and writes extracted phrases to `extractionFile`.

## Runtime API

### Default export

```ts
import u from 'ubersetz'
```

Signature:

```ts
u(key, defaultValue)
u(key, params, defaultValue)
```

Examples:

```ts
u('greeting', 'Hello world!')
u('welcome', { name: 'Ada' }, 'Welcome {name}!')
```

### Named exports

```ts
import {
  translate,
  translateWithLocale,
  getLocale,
  setLocale,
  setLocaleSync,
  loadLocale,
  loadLocaleSync,
  onLocaleChange,
} from 'ubersetz'
```

## MessageFormat examples

### Variables

```ts
u('hello', { name: 'Sam' }, 'Hello {name}!')
```

### Plural

```ts
u('cart.items', { count: 1 }, '{count, plural, one {# item} other {# items}}')
```

### Select

```ts
u(
  'profile.owner',
  { gender: 'female' },
  '{gender, select, male {His} female {Her} other {Their}} profile',
)
```

### Selectordinal

```ts
u(
  'race.place',
  { pos: 3 },
  'You finished {pos, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
)
```

### Number / date / time

```ts
u('price', { amount: 1234.5 }, 'Total: {amount, number, :: currency/USD}')
u('created', { date: new Date() }, 'Created on {date, date, long}')
```

## Locale files

Ubersetz stores locale messages as flat JSON maps:

```json
{
  "greeting": "Hello {name}!",
  "item_count": "{count, plural, one {# item} other {# items}}"
}
```

At runtime, these strings are compiled with MessageFormat for the active locale.

## Legacy plural compatibility

Older locale files may still contain entries like this:

```json
{
  "item_count": "One item",
  "item_count_plural": "{count} items"
}
```

The runtime still supports this format for compatibility, but the preferred format is a single MessageFormat string under one key.

## CLI

### Extraction

Run in your project root:

```sh
npx @ubersetz/cli .
```

Default behavior:

- scans configured file extensions
- extracts `u(key, defaultValue)` and `u(key, params, defaultValue)` calls
- supports multiline calls, template literals, and tagged template literals during extraction
- writes `extractionFile`
- copies new phrases into the base locale
- removes deleted phrases from configured locale files
- reports untranslated keys

### Migration

Convert legacy `key` + `key_plural` locale files into MessageFormat-based locale files:

```sh
npx @ubersetz/cli migrate
```

Preview without writing:

```sh
npx @ubersetz/cli migrate --dry-run
```

### Autotranslation

Example config:

```json
{
  "baseLocale": "en-us",
  "extractionFile": "locales/extracted.json",
  "autotranslate": {
    "plugin": "deepl",
    "concurrency": 5
  },
  "locales": [
    {
      "name": "English (US)",
      "code": "en-us",
      "file": "locales/en-us.json"
    },
    {
      "name": "German",
      "code": "de-de",
      "file": "locales/de-de.json",
      "autotranslate": true
    }
  ]
}
```

The CLI resolves `"deepl"` to the package `ubersetz-plugin-deepl`.

If `DEEPL_API_KEY` is present, the plugin uses the official DeepL client. Otherwise it falls back to the browser-based `deapl` package.

## Monorepo development

### Install dependencies

```sh
npm install
```

### Validate

```sh
npm run lint
npm run type-check
npm test -- --run
```

### Build all packages

```sh
npm run build
```

### Workspace layout

```text
packages/
  core/           runtime package published as `ubersetz`
  cli/            CLI package published as `@ubersetz/cli`
  plugin-deepl/   DeepL plugin package published as `ubersetz-plugin-deepl`
```

## Notes for contributors

- change source files under `src/`, not `dist/`
- keep the runtime API stable unless a breaking change is intentional
- keep MessageFormat support first-class
- add tests when changing runtime, extraction, migration, or autotranslation behavior
- package READMEs are intentionally minimal; keep detailed documentation in this root README

## Contributing

Contributions are welcome. Please open an issue or pull request.

## Maintainer

- Max Nowack ([maxnowack](https://github.com/maxnowack))

## License

MIT

Copyright (c) Max Nowack
