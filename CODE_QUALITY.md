# Code quality

How the code is organised, the rules it is held to, and where each rule is enforced. Everything on
this page is checked by `npm run verify`, locally and in CI.

## Structure

Three workspaces, each with one reason to change. Imports only point downwards.

| Workspace                      | Job                                                                                      | May import    |
| :----------------------------- | :--------------------------------------------------------------------------------------- | :------------ |
| [packages/core](packages/core) | The domain as pure functions and types: AQI scoring, air windows, household rules, hacks | nothing       |
| [server](server)               | The API: validation, Open-Meteo, Gemini, caching, security headers, static hosting       | `@saans/core` |
| [web](web)                     | The page: one Svelte component per section, a typed API client, storage, formatting      | `@saans/core` |

- The core does no input or output, so the browser and the server compute the same bands and
  windows from the same code, and the domain is tested without a single fake.
- Everything the server needs from outside (fetch, the Gemini call, the clock, the configuration)
  is injected through one interface in [app.ts](server/src/app.ts); only
  [index.ts](server/src/index.ts) touches the real ones. Tests run the real app offline.
- Data that crosses a boundary is narrowed, never asserted: zod schemas on the server
  ([schemas.ts](server/src/schemas.ts)), runtime guards in the browser
  ([guards.ts](web/src/lib/guards.ts)).
- Each module opens with a comment that says what its one job is, and every export has a doc
  comment.

## Limits enforced by lint

From [eslint.config.js](eslint.config.js), with zero warnings allowed:

| Rule                                       | Limit                                              |
| :----------------------------------------- | :------------------------------------------------- |
| `complexity`                               | cyclomatic complexity 10                           |
| `max-lines-per-function`                   | 60 lines                                           |
| `max-lines`                                | 250 lines per file                                 |
| `max-depth`, `max-params`                  | 3 levels, 4 parameters                             |
| `consistent-type-assertions`               | no `as` casts (only `as const`)                    |
| `no-explicit-any`, `no-non-null-assertion` | forbidden (typescript-eslint strict, type-checked) |
| `noInlineConfig`                           | no rule can be switched off from inside a file     |
| `no-console`                               | only the error handler and the start-up line log   |
| `no-warning-comments`                      | no parked work in comments                         |
| `svelte/no-at-html-tags`                   | generated text reaches the page only as text nodes |

TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noUnusedLocals` and `noUnusedParameters` ([tsconfig.base.json](tsconfig.base.json)). Svelte's own
accessibility warnings fail the type check (`svelte-check --fail-on-warnings`); the one
exception, the focusable scrolling region around the hourly table, is marked and explained where
it occurs. Prettier formats every file.

## Conventions enforced by tests

[conventions.test.ts](server/src/conventions.test.ts) reads the repository and fails unless every
module opens with its purpose, no file silences ESLint or TypeScript, the list of modules
without a test file of their own stays exactly the short list that is covered through the app
tests, and no text uses an em dash.

## Named values, one source of truth

Limits and vocabularies are constants with a comment that says why they have that value, defined
once and shared: the household count limit, bands, commute modes and hack ids live in
[types.ts](packages/core/src/types.ts) and are used by the form, the storage guard and the API
schema. Coverage gates (100 % on the core and the server) and a 30 kB JavaScript
budget keep additions honest.
