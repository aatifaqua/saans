# Security

## Reporting

Please report a vulnerability privately through GitHub's "Report a vulnerability" button on this
repository rather than in a public issue.

## Threat model

Saans is a public, sign-in free app. The server is stateless: it stores no profiles, plans,
questions or answers, and it has no database, ids or uploads, so there is nothing to read back or
leak between users.

| Asset or risk                | Control                                                                                                                                                                                                                          | Where                                                                                             |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| Gemini API key               | Held in Google Secret Manager and injected into Cloud Run at deploy; never in the repo, the image, logs or responses. Locally it lives in a gitignored `server/.env`. The server refuses to start in production without it.      | [config.ts](server/src/config.ts), [Dockerfile](Dockerfile)                                       |
| Malformed or oversized input | Strict zod schemas (unknown fields are rejected), 16 kB body limit, bounded counts and lengths                                                                                                                                   | [schemas.ts](server/src/schemas.ts), [app.ts](server/src/app.ts)                                  |
| Prompt injection             | Control, zero-width and bidi characters and angle brackets are stripped from user text; context is wrapped in a tag the user cannot close; the model may only pick hacks from an allow-list, checked server-side                 | [prompts.ts](server/src/ai/prompts.ts), [schemas.ts](server/src/schemas.ts)                       |
| Invented or unsafe advice    | Every number comes from the forecast maths, not the model; answers are schema-validated; Gemini safety settings are explicit; the "not medical advice" note is on the UI, every API response, the system prompts and every error | [context.ts](packages/core/src/context.ts), [gemini.ts](server/src/ai/gemini.ts)                  |
| Abuse and cost               | Per-client rate limits (60 per minute overall, 10 per minute on AI routes) keyed on the address Cloud Run appends, per-model timeouts and a chain deadline, Cloud Run max instances                                              | [middleware.ts](server/src/middleware.ts), [gemini.ts](server/src/ai/gemini.ts)                   |
| Untrusted upstream data      | Open-Meteo responses are schema-checked, with timeouts; failures become a generic 502                                                                                                                                            | [openMeteo.ts](server/src/openMeteo.ts)                                                           |
| XSS and clickjacking         | Strict CSP (`'self'` only, no inline script or style), `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy (geolocation for this origin only); model text is rendered as text, never HTML (lint-enforced)     | [middleware.ts](server/src/middleware.ts), [eslint.config.js](eslint.config.js)                   |
| Information leaks            | Generic error messages; only the error name is logged, never request bodies                                                                                                                                                      | [errors.ts](server/src/errors.ts)                                                                 |
| Privacy                      | The household profile stays in the browser's local storage; device location is rounded to about 1 km before it is sent                                                                                                           | [storage.ts](web/src/lib/storage.ts), [PlaceSearch.svelte](web/src/components/PlaceSearch.svelte) |
| Supply chain                 | Exact-pinned dependencies, SHA-pinned CI actions, `npm audit` and CodeQL in CI, Dependabot security updates                                                                                                                      | [.github](.github)                                                                                |
