# Testing

`npm run verify` runs the full gate locally and in CI: Prettier, ESLint with zero warnings,
TypeScript and svelte-check, every test suite with its coverage gate, the production build and the
JavaScript size budget.

| Layer       | What is tested                                                                                                                                                                                                                                                                                                                                                                                       | Tests | Coverage gate                                                                                          |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---- | :----------------------------------------------------------------------------------------------------- |
| Domain core | National AQI breakpoints and band edges, household limits, clean and worst windows (gaps, night hours, all-smog days, episodes), hack selection rules, the grounding JSON                                                                                                                                                                                                                            | 39    | 100 % lines, branches, functions, statements                                                           |
| Server      | Every route through the real Hono app with Open-Meteo and Gemini faked: validation, caching and coalescing, the model chain (busy, slow, retired, rejected, truncated and invalid answers), honest 503 when no model answers, security headers, same-site JSON gate, rate limits, body limit, static hosting, and the repository conventions (module headers, no silenced rules)                     | 71    | 100 % lines, branches, functions, statements                                                           |
| Web app     | Components and the full app in jsdom: forms, search, location, plan, follow-up, retry after failure, stale answers dropped, storage that is blocked or corrupt, field errors and busy buttons, axe on every component state and on the whole page with a plan, page structure and stylesheet rules (headings, landmarks, focus ring, target size, reflow, motion), contrast from the real stylesheet | 114   | 100 % lines, functions, statements; 85 % branches (Svelte compiles extra update paths into each block) |

Failure paths are tested on purpose: Open-Meteo down or malformed, every Gemini model failing,
answers cut off by the token limit, hacks outside the offered list, cross-site or non-JSON posts,
and households with nobody in them.

The tests never call Gemini or Open-Meteo, so they are fast and free. The live app is checked
separately against the deployed URL in a real browser (search, plan, follow-up, both themes).

Run one layer with `npm test -w packages/core`, `npm test -w server` or `npm test -w web`.
