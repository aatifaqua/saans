# Saans: design

Saans (Hindi and Urdu for "breath") is an urban air quality assistant that helps families get
through severe winter smog with a personalised, low-emission daily routine and indoor air hacks,
built on live air quality data and Google Gemini.

## 1. Problem and intent

Every winter, cities across North India sit under smog for weeks. Families know the air is bad
but not what to do about it today: when it is least harmful to take the children out, whether to
open the windows, how to commute without breathing (or adding to) the worst of it, and which
cheap indoor changes actually help. Generic AQI apps show a number; Saans turns the number into a
plan for this household, today.

## 2. Goals, non-goals, anti-goals

Goals (each traces to a phrase of the problem statement):

| Brief phrase                       | Feature                                                                                                                                                                                                                                                                                          |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urban air quality                  | Live current AQI and a 48-hour hourly forecast for the family's city (search by name or use device location), shown on the Indian National AQI scale                                                                                                                                             |
| Help families                      | A household profile: who lives at home (children, adults, older adults, pregnancy), health sensitivities (asthma, heart or lung condition), commute and outdoor habits                                                                                                                           |
| Beat severe winter smog            | Smog-episode detection and the cleanest and worst windows of the next 48 hours, computed deterministically from the forecast                                                                                                                                                                     |
| Personalised low-emission routines | Gemini writes today's routine for this household: when to go out, exercise, air the home, how to commute; each step cites the forecast window it relies on. "Low-emission" covers both lowering the family's exposure and lowering what the family emits (car idling, trip chaining, no burning) |
| Indoor air hacks                   | Gemini picks and tailors hacks from a curated, sourced catalogue (DIY box-fan filter, purifier sizing, sealing, cooking and incense habits, ventilation timing) to the household and today's air                                                                                                 |
| GenAI assistant                    | A follow-up "Ask" box: questions about today's plan answered by Gemini with the same air and household context                                                                                                                                                                                   |

Non-goals: accounts, server-side storage, multiple saved households, notifications, maps,
languages other than English, pollutant chemistry beyond PM2.5 / PM10, any feature the brief
does not name.

Anti-goals (failure even if it works):

- **The deployed app runs without live AI.** There is no demo mode, no saved example output, no
  offline routine writer. If Gemini is unavailable, the app says so and offers a retry; it never
  substitutes canned text for a model answer.
- Medical advice. Saans gives general guidance and says so on four surfaces: the UI, every API
  response, the system prompts, and the error paths.
- A heavy codebase. The whole repository should be readable in one sitting.

## 3. Constraints

- Public GitHub repository under `aatifaqua`, under 10 MB, single branch `main`.
- Deadline 2026-11-29 23:59 IST; at most three graded submissions; a demo video link (unlisted
  YouTube) is part of the submission.
- Gemini via the Gemini API key; key never in the repository, held in Google Secret Manager in
  production and in a gitignored `server/.env` locally.
- Air data: Open-Meteo Air Quality and Geocoding APIs (free, no key).
- Deployed on Google Cloud Run (region `asia-south1`), one service serving API and web app from
  one origin.
- Repository text: no em dashes; code comments never cite sections of this document.

## 4. Approaches considered

1. **Lean three-package workspace, Cloud Run (chosen).** `packages/core` (pure TypeScript, zero
   dependencies: AQI maths, window finding, household rules, hack catalogue), `server` (Hono,
   `@google/genai`, zod), `web` (Svelte 5 + Vite, one CSS file). One Docker image on Cloud Run
   with the key from Secret Manager. Smallest footprint that still has a real domain layer.
2. **Single Next.js app on Cloud Run.** Fewer packages, but React's bundle weight and framework
   boilerplate grow the codebase and slow the first screen.
3. **Static site calling Gemini from the browser.** No server, but the key would be public or the
   AI would have to be off in the deployed build. Rejected outright.

## 5. Architecture

```
browser (Svelte)                         Cloud Run (Hono)                    external
 profile form (localStorage)  ─────►  GET  /api/places?q=          ──►  Open-Meteo geocoding
 AQI card + 48h strip          ◄─────  GET  /api/air?lat=&lon=       ──►  Open-Meteo air quality
 routine + hacks               ◄─────  POST /api/plan  {household, place}  ──►  Gemini (structured output)
 Ask box                       ◄─────  POST /api/ask   {household, place, question}  ──►  Gemini
                                       GET  /api/health
```

- `@saans/core` is imported by both sides. The browser uses it to render bands and windows from
  `/api/air` without another round trip; the server uses it to build the grounded context it sends
  to Gemini, so the model never invents numbers.
- The server is stateless: no database, no ids, no uploads. The household profile lives only in
  the browser's localStorage and travels in the request body.
- Air responses are cached in memory per rounded coordinate (2 decimals) for 15 minutes, with
  in-flight request coalescing; geocoding results for 24 hours. Gemini answers are not cached.

## 6. Domain core

- **Indian National AQI** (CPCB) sub-indices from PM2.5 and PM10 with the published breakpoints;
  the AQI is the higher sub-index. Hourly values use the hourly concentration against the same
  breakpoints (stated as an assumption in the README, since the official index uses 24-hour
  averages). Bands: Good, Satisfactory, Moderate, Poor, Very Poor, Severe, each shown by name
  so colour is never the only signal.
- **Windows:** from the 48-hour series, the cleanest contiguous 1 to 3 hour windows during waking
  hours (06:00 to 22:00 local) and the worst stretch; "smog episode" when the 24-hour mean is Very
  Poor or worse.
- **Household rules:** a small table maps profile facts to constraints passed to the model and
  shown as "Why?" reasons, for example: children or older adults or a sensitive member lowers the
  outdoor threshold by one band; asthma adds "keep reliever inhaler on outings"; a car commute adds
  "no idling, recirculate cabin air, combine trips".
- **Hack catalogue:** about 15 hacks, each with an id (string literal union), the conditions it
  fits, cost tier, and a one-line source note. Gemini may only choose ids from this list, then
  tailor the wording; the server validates the ids.
- Ids, bands, member types and commute modes are string literal unions from the start.

## 7. AI layer

- `/api/plan`: system prompt (role, India context, general-guidance disclaimer, never diagnose,
  use only the supplied numbers), user payload = compact JSON of the household, the band summary,
  windows and the allowed hack ids. Gemini returns structured JSON validated by zod: routine steps
  (time, action, and a reason naming the window or household fact), low-emission tips, chosen hacks with tailored text, one-line
  summary.
- `/api/ask`: same grounded context plus the question (max 500 characters); plain text answer.
- Model chain `gemini-3.6-flash` then `gemini-3.5-flash` (configurable by env), per-model timeout
  and an overall deadline, retry only on 429 / 5xx. Safety settings on. Input sanitised (control
  and zero-width characters stripped, prompt markers neutralised).
- When the chain fails the endpoint returns 503 with a clear message; the UI keeps showing the
  live air data and windows (labelled as computed from the forecast) and offers Retry. Nothing is
  presented as AI output unless it came from Gemini on this request.

## 8. Security and efficiency

- zod on every input; body size limit; per-IP rate limit (Cloud Run trusted proxy header);
  secure headers with a strict CSP (no `unsafe-inline` for scripts or styles), Permissions-Policy
  allowing geolocation for self only; generic 500s; logs truncated, no request bodies logged.
- Key from Secret Manager on Cloud Run; service runs as a non-root user; `npm audit` and CodeQL in
  CI; Dependabot security updates only (no version-bump branches).
- Web: Svelte 5, `sideEffects: false` on core, compression, long cache on hashed assets, hoisted
  `Intl` formatters, single-pass window scan, CI bundle size budget.

## 9. Quality bars

- TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; ESLint
  `strictTypeChecked` with complexity budgets and zero warnings; no `any`, no non-null `!`, no
  casts other than `as const`.
- Vitest with coverage thresholds on all three packages; vitest-axe on every component.
- Accessibility: skip link, landmarks, labelled form controls, non-colour bands, live region for
  AI results, reduced motion, visible focus, contrast checked in light and dark.
- JSDoc on every export stating the reason for non-obvious choices.

## 10. README shape

Opens with the problem statement and a requirement to feature to file table, then: chosen
vertical, approach and logic, how it works, Google services used and where (Gemini, Cloud Run,
Secret Manager), assumptions, run locally, deploy, disclaimer.

## 11. Decisions settled before planning

- **Ask context:** the client sends the plan it was shown back with the question; the server
  validates it with the same zod schema used for Gemini's plan output (size-capped, sanitised).
  One question per request, no conversation history.
- **Outdoor thresholds:** healthy adults go outdoors at Moderate or better; any child, older
  adult, pregnancy or sensitive member lowers the household threshold to Satisfactory. If no
  waking-hours window meets the threshold, the core returns the least-bad window flagged
  `leastBad`, and the routine is indoor-first (outings shortened, N95 mask, no outdoor exercise).
- **"Today":** the next 24 hours from now in the place's own time zone (Open-Meteo
  `timezone=auto`); the strip shows 48 hours, the routine covers 24. The smog-episode check uses
  the mean of those 24 hours.
- **Region:** place search is limited to India (geocoding `countryCode=IN`). Device location is
  allowed and shown as "Your location" with rounded coordinates.
- **Setup:** a new Google Cloud project on the existing open billing account; the Gemini key
  already lists `gemini-3.5-flash`, `3.6-flash`, `3.8-flash`. The GitHub repo is created at
  publish time. The demo video is in scope after deployment.

## 12. Left to the builder

Exact component split, copy, palette, the precise hack list (sourced from WHO / CPCB / EPA style
guidance), test layout, and CI details.
