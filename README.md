# Saans

**A GenAI assistant that helps families and communities get through severe winter smog: live air
for your city, the cleanest hours of the day, and a plan written live by Google Gemini for your
household, with a low-emission routine, indoor air quality hacks, sustainable alternatives and
community actions, each explaining its direct impact.**

Live app: **https://saans-23907312550.asia-south1.run.app**

> General guidance, not medical advice. If anyone has trouble breathing or chest pain, seek
> medical care.

_Saans_ means "breath" in Hindi and Urdu.

---

## Chosen vertical

**Urban Air Quality Assistant** (Challenge 06). The problem statement:

> Create a GenAI-powered assistant that helps families and communities navigate severe winter
> smog and urban air pollution. The application should suggest low-emission daily routines,
> indoor air quality hacks, and sustainable alternatives tailored to their location and
> lifestyle, while clearly explaining the direct impact of their choices.

Every winter, cities across North India sit under smog for weeks. Families know the air is bad
but not what to do about it today: when it is least harmful to take the children out, whether to
open the windows, how to commute without breathing (or adding to) the worst of it, and which
cheap indoor changes actually help. Saans turns today's forecast into a plan for one household
and its neighbourhood.

## Requirement → feature → file

| Problem statement                                     | Feature                                                                                                                                                                                                                                                                          | Where                                                                                                                                                                                              |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GenAI-powered assistant                               | Every plan and answer is written live by Gemini on request, as schema-checked JSON grounded on the forecast; the UI names the model that wrote it                                                                                                                                | [gemini.ts](server/src/ai/gemini.ts), [routes/ai.ts](server/src/routes/ai.ts), [PlanPanel.svelte](web/src/components/PlanPanel.svelte)                                                             |
| Families                                              | Household profile: children, adults, older adults, pregnancy, asthma, heart or lung conditions, commute, outdoor exercise, purifier. A vulnerable member lowers the household's outdoor limit                                                                                    | [household.ts](packages/core/src/household.ts), [HouseholdForm.svelte](web/src/components/HouseholdForm.svelte)                                                                                    |
| Communities                                           | "For your community": 1 to 3 actions for the building, school or neighbourhood (shared trips, no burning, alerts for neighbours), each with its impact                                                                                                                           | [schemas.ts](server/src/schemas.ts), [prompts.ts](server/src/ai/prompts.ts), [PlanPanel.svelte](web/src/components/PlanPanel.svelte)                                                               |
| Navigate severe winter smog and urban air pollution   | Live current AQI and a 48-hour hourly forecast on the Indian National AQI scale, smog-episode detection, the cleanest waking-hour windows within the household's limit and the worst stretch                                                                                     | [aqi.ts](packages/core/src/aqi.ts), [windows.ts](packages/core/src/windows.ts), [AirNow.svelte](web/src/components/AirNow.svelte), [ForecastStrip.svelte](web/src/components/ForecastStrip.svelte) |
| Low-emission daily routines                           | Today's routine (outings, school run, exercise, airing the home) placed inside the computed clean windows, each step saying which window or household fact it relies on                                                                                                          | [prompts.ts](server/src/ai/prompts.ts), [PlanPanel.svelte](web/src/components/PlanPanel.svelte)                                                                                                    |
| Indoor air quality hacks                              | A sourced catalogue of 13 hacks (DIY box fan filter, purifier sizing and run times, sealing gaps, clean room, kitchen exhaust, wet mopping and more); the day and household decide which are offered, Gemini picks and tailors them, and the server rejects any outside the list | [hacks.ts](packages/core/src/hacks.ts), [schemas.ts](server/src/schemas.ts)                                                                                                                        |
| Sustainable alternatives                              | 2 to 5 swaps that fit the household's lifestyle (metro instead of the car, electric heat instead of burning, combined errands), each as "instead of" with its impact                                                                                                             | [prompts.ts](server/src/ai/prompts.ts), [PlanPanel.svelte](web/src/components/PlanPanel.svelte)                                                                                                    |
| Tailored to their location                            | Place search across India or device location (rounded to about 1 km); every number comes from that place's live forecast in its own time zone                                                                                                                                    | [openMeteo.ts](server/src/openMeteo.ts), [PlaceSearch.svelte](web/src/components/PlaceSearch.svelte), [windows.ts](packages/core/src/windows.ts)                                                   |
| Tailored to their lifestyle                           | Commute mode, outdoor exercise, purifier ownership and health conditions change the limit, the offered hacks and the grounding Gemini writes from                                                                                                                                | [household.ts](packages/core/src/household.ts), [hacks.ts](packages/core/src/hacks.ts), [context.ts](packages/core/src/context.ts)                                                                 |
| Clearly explaining the direct impact of their choices | Every alternative, hack and community action carries an "Impact" line; routine steps carry their "Why"; numbers appear only when they come from the forecast                                                                                                                     | [schemas.ts](server/src/schemas.ts), [prompts.ts](server/src/ai/prompts.ts), [PlanPanel.svelte](web/src/components/PlanPanel.svelte)                                                               |
| Follow-up questions                                   | Ask about today: Gemini answers with the same live air, household and plan on screen; breathing trouble or chest pain is always referred to medical care                                                                                                                         | [AskBox.svelte](web/src/components/AskBox.svelte), [routes/ai.ts](server/src/routes/ai.ts)                                                                                                         |

## Approach and logic

**Deterministic maths first, Gemini for the words.** The numbers that decide safety are computed,
never generated:

1. **AQI.** Each hour's PM2.5 and PM10 are converted with the CPCB National AQI breakpoints; the
   AQI is the higher sub-index, banded Good to Severe.
2. **Household limit.** Healthy adults go out up to Moderate. Any child, older adult, pregnancy or
   heart, lung or asthma condition moves the household to Satisfactory, one band earlier, as the
   CPCB health advice does for sensitive groups.
3. **Windows.** Over the next 24 hours, waking hours (06:00 to 21:59) within the limit are grouped
   into runs, and the cleanest stretch of up to three hours in each run is kept (best three
   overall). When nothing qualifies, the single least bad waking hour is offered, flagged so the
   routine stays indoor-first. A 24-hour mean of Very Poor or worse is a smog episode.
4. **Candidate hacks.** Each hack declares when it fits (for example, sizing a purifier only for
   homes without one, airing the home only when a genuinely clean window exists).
5. **Grounding.** All of this is sent to Gemini as one compact JSON context. The model orders and
   explains it in plain language, returns JSON matching a schema, and may only choose offered hacks.

## How the solution works

```
browser (Svelte)                          Cloud Run (Hono, stateless)               external
 search / location   ── GET /api/places ──▶ cached 24 h ───────────────────────────▶ Open-Meteo geocoding
 AQI, windows, strip ◀─ GET /api/air ─────  cached 15 min, coalesced ──────────────▶ Open-Meteo air quality
   (computed in the browser by @saans/core)
 Make today's plan   ── POST /api/plan ───▶ air ▶ core outlook ▶ grounding ▶ Gemini (structured JSON)
 Ask about today     ── POST /api/ask ────▶ same grounding + the plan ▶ Gemini
```

1. **Pick a place** by search (India only) or device location (rounded to about 1 km).
2. **Describe the household.** It is saved in this browser only and changes the limit and the
   windows instantly, with no request.
3. **Make today's plan.** The server fetches the forecast itself (so the numbers cannot be
   altered by the client), builds the grounding, and asks Gemini. Models are tried in order
   (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, then `gemini-3.6-flash`) with a 15 s per-model timeout and a 55 s overall deadline;
   any failure (busy, slow, retired or rejected) moves on to the next model, and
   an answer that fails the schema or names an unoffered hack counts as a failure.
4. **If Gemini is unavailable** the app says so and offers Retry. It never shows saved or canned
   text in place of a live answer.

## Google services used

| Service                                                                                                                                    | Where and why                                                                                                                                                                                                                                   |
| :----------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gemini API** (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, then `gemini-3.6-flash`) via `@google/genai` | Writes the routine, sustainable alternatives, tailored hacks and community actions with their impact as schema-constrained JSON, and answers follow-up questions: [gemini.ts](server/src/ai/gemini.ts), [routes/ai.ts](server/src/routes/ai.ts) |
| **Cloud Run** (asia-south1)                                                                                                                | Hosts the one container that serves the API and the web app: [Dockerfile](Dockerfile)                                                                                                                                                           |
| **Secret Manager**                                                                                                                         | Holds the Gemini API key, injected into Cloud Run at deploy                                                                                                                                                                                     |
| **Cloud Build and Artifact Registry**                                                                                                      | Build the container from source on deploy                                                                                                                                                                                                       |

## Assumptions

- The official National AQI uses 24-hour averages. Saans applies the same breakpoints to hourly
  forecast concentrations so hours within a day can be compared; the result is a guide, not an
  official reading.
- Forecasts come from Open-Meteo (Copernicus CAMS model, about 11 km resolution), not ground
  stations, so street-level air can differ.
- Advice is general guidance for households, not medical advice. Sources for each hack are named
  in the app and in [hacks.ts](packages/core/src/hacks.ts).
- English only; place search covers India.

## Quality

| Area          | Evidence                                                                                                                                                                                                                                                                                                                                     |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality  | TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint `strictTypeChecked` with complexity and size budgets, zero warnings, no type casts, a doc comment on every export, one pure domain package shared by server and browser: [eslint.config.js](eslint.config.js), [tsconfig.base.json](tsconfig.base.json) |
| Security      | Stateless server, strict CSP and every hardening header stated, same-site JSON gate, zod on every input, rate limits, key in Secret Manager, CodeQL, dependency review and a secret scan in CI: [SECURITY.md](SECURITY.md)                                                                                                                   |
| Efficiency    | Measured below; the outlook is recomputed in the browser with no request, upstream calls are cached and coalesced, hashed assets are immutable, and a CI budget fails the build above 30 kB of JavaScript: [size-budget.js](web/size-budget.js)                                                                                              |
| Testing       | 166 tests; 100 % coverage gates on the core and the server, 100 % lines and functions on the web app: [TESTING.md](TESTING.md)                                                                                                                                                                                                               |
| Accessibility | WCAG 2.2 AA design with contrast checked in tests for both themes and axe on every component state: [ACCESSIBILITY.md](ACCESSIBILITY.md)                                                                                                                                                                                                     |

Measured on the live app (gzip):

| What                    | Size            | Cached                                     |
| :---------------------- | :-------------- | :----------------------------------------- |
| JavaScript bundle       | 23.5 kB         | a year (content-hashed)                    |
| Stylesheet              | 1.9 kB          | a year (content-hashed)                    |
| Page                    | 0.8 kB          | revalidated each visit                     |
| `/api/air` (72 hours)   | 0.8 kB          | 15 min on the server, 5 min in the browser |
| `/api/places`           | 0.2 kB          | a day                                      |
| `/api/plan`, `/api/ask` | about 1 to 2 kB | never: each answer is live                 |

## Run locally

Requires Node 22.18 or newer.

```sh
npm ci
cp .env.example server/.env   # add your GEMINI_API_KEY
npm run dev                   # API on http://localhost:8080
npm run dev -w web            # app on http://localhost:5173 (proxies /api)
npm run verify                # format, lint, typecheck, tests, build
```

## Deploy (Cloud Run)

```sh
printf %s "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
gcloud run deploy saans --source . --region asia-south1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest --max-instances 3
```

## Project layout

```
packages/core   pure TypeScript domain: AQI, windows, household rules, hacks, grounding
server          Hono API: Open-Meteo proxy, Gemini routes, security middleware
web             Svelte 5 app, one stylesheet
```

## License

[MIT](LICENSE)
