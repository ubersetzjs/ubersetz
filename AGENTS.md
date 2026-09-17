# AGENTS.md

## Purpose

This repository contains the **ubersetz** monorepo.

Ubersetz is an i18n framework centered around an ergonomic inline translation API and a CLI-driven extraction workflow. Its architecture is split into focused packages:

- `packages/core` — runtime translation API
- `packages/cli` — extraction, migration, locale file maintenance, autotranslation orchestration
- `packages/plugin-deepl` — DeepL autotranslation adapter

The primary responsibility of any AI agent working in this repository is to extend or maintain ubersetz while preserving:

- the **public API shape**
- the **package boundaries**
- the **MessageFormat-first direction**
- the **monorepo tooling health**

---

## Source of Truth

The following are authoritative, in this order:

1. the current user request
2. this `AGENTS.md`
3. `README.md`
4. package-level documentation, especially `packages/cli/README.md`
5. package manifests and build/test configuration
6. existing code and tests in this repository

If there is a conflict:

- the current user request takes precedence for the task at hand
- `AGENTS.md` takes precedence for repository working rules
- `README.md` is the repository-level source of truth for project purpose, package overview, and expected usage
- package docs should describe behavior, but if they are stale, update them to match the implementation rather than forcing code back to outdated docs
- existing code should be aligned with the intended architecture rather than treated as the final authority when behavior, tests, and docs clearly point elsewhere

---

## Repository Mental Model

Think about the repository in this order:

1. **public developer experience**
2. **MessageFormat semantics**
3. **runtime behavior**
4. **extraction and locale-file workflows**
5. **autotranslation adapters**
6. **build and package outputs**

The public API should remain intuitive and stable.
Implementation details may evolve, but the library should continue to feel small and obvious to consumers.

---

## Monorepo Structure

### `packages/core`

Owns the translation runtime.

Responsibilities:

- `u(key, params, defaultValue)` and related exports
- locale loading and switching
- MessageFormat compilation and rendering
- backwards compatibility where intentionally supported

Do not move CLI behavior into `core`.

### `packages/cli`

Owns developer tooling around phrases and locale files.

Responsibilities:

- phrase extraction from source files
- writing extraction output
- locale reconciliation
- migration commands
- autotranslation orchestration
- config loading from `.ubersetzrc`

Do not turn the CLI into a second runtime implementation.

### `packages/plugin-deepl`

Owns DeepL-specific translation integration.

Responsibilities:

- adapter behavior for DeepL APIs
- placeholder preservation
- retry/concurrency management specific to that provider

Keep provider-specific logic here rather than leaking it into the CLI.

---

## Architectural Rules

### Preserve Package Boundaries

Do not invent a new architecture unless the user explicitly asks for it.

Before creating new files:

- check which package truly owns the concern
- follow existing naming and file-placement patterns
- prefer extending existing utilities before introducing parallel abstractions

### MessageFormat-First Development

Ubersetz v2 is MessageFormat-first.

That means:

- support full MessageFormat syntax when changing runtime behavior
- preserve full MessageFormat strings in locale data when possible
- avoid reintroducing split-key plural hacks as the primary model
- keep any legacy compatibility code clearly transitional and isolated

### Public API Stability

The default translation API is a core product constraint:

- keep `u(key, params, defaultValue)` intact unless the user explicitly approves a breaking change
- preserve existing named exports unless there is a strong reason and the change is coordinated
- prefer internal refactors over public API churn

### Runtime vs Tooling Separation

Business rules of translation formatting belong in `core`.
Developer workflows belong in `cli`.
Provider-specific translation logic belongs in plugins.

Do not blur these layers.

### Locale-Data Compatibility

When changing locale storage behavior:

- consider how existing locale JSON files behave
- provide migration or compatibility paths where reasonable
- avoid silent destructive rewrites

### Generated Output Discipline

`dist/` files are build artifacts.

- do not edit generated output manually
- change source files under `src/`
- rebuild when output verification is needed

---

## Tooling Expectations

The standard repository checks are:

- `npm run lint`
- `npm run type-check`
- `npm test -- --run`
- `npm run build`

When working on a single package, workspace-scoped commands are appropriate, but do not leave the repository in a state where the root checks fail.
If a change could affect packaging, bundling, entrypoints, runtime dependencies, or generated output, run `npm run build` before finishing.

Prefer validating the smallest relevant scope first, then run the root checks before finishing substantial work.

---

## Coding Rules

### Before Coding

- **(MUST)** Ask clarifying questions when requirements are ambiguous or multiple valid interpretations exist
- **(SHOULD)** Draft and confirm an approach for complex or breaking work
- **(MUST)** When debugging, identify plausible explanations before changing code
- **(MUST)** Challenge your own bug hypothesis before implementing a fix
- **(MUST)** Prefer fixes that address the underlying cause rather than masking symptoms
- **(MUST)** Do not remove intended behavior just to make a test pass or a bug disappear unless the user explicitly wants that behavior removed
- **(SHOULD)** Check whether docs or tests already describe the intended behavior before changing implementation semantics

### While Coding

- **(MUST)** Use TypeScript
- **(MUST)** Use `import type { ... }` for type-only imports
- **(MUST)** Use single quotes
- **(MUST)** Omit semicolons
- **(SHOULD)** Prefer small, composable, testable functions
- **(SHOULD NOT)** Introduce classes unless the surrounding design clearly benefits from one
- **(SHOULD)** Default to `type`; use `interface` when clearer or when declaration merging is desired
- **(SHOULD NOT)** Add comments unless they capture an important caveat that is not obvious from code
- **(SHOULD)** Keep code strictly typed and avoid `any`
- **(MUST)** Follow existing naming conventions and package-local patterns
- **(SHOULD)** Prefer self-explanatory names over abbreviations
- **(SHOULD)** Prefer default exports when that matches the surrounding package pattern
- **(MUST)** Do not add speculative code for future use without a present need

### Testing

- **(MUST)** Add or update tests when changing runtime, extraction, migration, or autotranslation behavior
- **(SHOULD)** Put tests next to the relevant source file when following the current package pattern
- **(MUST)** Verify both happy-path and compatibility-path behavior when changing migration or legacy support code

---

## Package-Specific Guidance

### Core

When editing `packages/core`:

- preserve locale-aware behavior
- keep MessageFormat compilation correct and explicit
- prefer caching/compilation strategies that are easy to reason about
- ensure missing-key fallback behavior remains deliberate
- do not reintroduce manual interpolation as the primary rendering path

### CLI

When editing `packages/cli`:

- treat extraction as a developer workflow, not runtime behavior
- prefer robust parsing over fragile regex hacks when MessageFormat syntax is involved
- keep migration steps idempotent where possible
- avoid destructive file rewrites that lose user-authored translations
- keep command behavior understandable from the CLI surface

### DeepL Plugin

When editing `packages/plugin-deepl`:

- preserve placeholders and MessageFormat-sensitive segments
- avoid leaking provider quirks into the generic CLI abstractions
- keep concurrency and retry behavior explicit

---

## Documentation Maintenance Rules

If an agent changes any of the following in a meaningful way, the relevant docs must be updated in the same change:

- public runtime API
- CLI commands or flags
- locale file format expectations
- migration workflow
- package responsibilities
- major architectural direction

At minimum, consider updating:

- `README.md` when repository-level usage, package responsibilities, or core workflows change
- `packages/cli/README.md` when CLI usage or behavior changes
- `AGENTS.md` when repository-wide working assumptions or architecture change

Do not leave architectural or workflow docs stale after structural changes.

---

## Implementation Workflow

Before implementing a feature or refactor:

1. identify which package owns the change
2. read the relevant source and nearby tests
3. determine whether the change affects runtime, extraction, migration, plugin behavior, docs, or build output
4. implement using existing conventions
5. add or update tests
6. run relevant package checks
7. run root validation commands for substantial changes, including `npm run build`

---

## Success Criteria

A successful implementation:

- preserves the intended package boundaries
- keeps the public API intuitive
- advances or preserves full MessageFormat support
- maintains compatibility consciously rather than accidentally
- keeps docs aligned with behavior
- leaves lint, type-check, tests, and builds in a healthy state
- can be understood and extended by future AI agents
