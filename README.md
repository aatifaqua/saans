# Saans

**An urban air quality assistant that helps families beat severe winter smog: live air for your
city, the cleanest hours of the day, and a personalised low-emission routine with indoor air hacks,
written live by Google Gemini for your household.**

Live app: **LIVE_URL**

> General guidance, not medical advice. If anyone has trouble breathing or chest pain, seek
> medical care.

_Saans_ means "breath" in Hindi and Urdu.

---

## Chosen vertical

**Urban Air Quality Assistant.** The brief: _"Build an Urban Air Quality Assistant to help
families beat severe winter smog with personalized low-emission routines and indoor air hacks."_

Every winter, cities across North India sit under smog for weeks. Families know the air is bad
but not what to do about it today: when it is least harmful to take the children out, whether to
open the windows, how to commute without breathing (or adding to) the worst of it, and which
cheap indoor changes actually help. Saans turns today's forecast into a plan for one household.

## Requirement → feature → file

| Brief                              | Feature                                                                                                                                                                                                                                                                      | Where                                                                                                                                                                                           |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urban air quality                  | Live current AQI and a 48-hour hourly forecast for any Indian city (search or device location), on the Indian National AQI scale computed from PM2.5 and PM10                                                                                                                | [aqi.ts](packages/core/src/aqi.ts), [openMeteo.ts](server/src/openMeteo.ts), [AirNow.svelte](web/src/components/AirNow.svelte), [ForecastStrip.svelte](web/src/components/ForecastStrip.svelte) |
| Help families                      | Household profile: children, adults, older adults, pregnancy, asthma, heart or lung conditions, commute, outdoor exercise, purifier. A vulnerable member lowers the household's outdoor limit                                                                                | [household.ts](packages/core/src/household.ts), [HouseholdForm.svelte](web/src/components/HouseholdForm.svelte)                                                                                 |
| Beat severe winter smog            | Smog-episode detection, the cleanest waking-hour windows within the household's limit (or the least bad hour when none qualifies), and the worst stretch to keep windows shut                                                                                                | [windows.ts](packages/core/src/windows.ts)                                                                                                                                                      |
| Personalised low-emission routines | Gemini writes today's routine (outings, school run, exercise, airing the home) inside the computed windows, plus tips that cut the family's own emissions (trips, idling, heating, burning), each with its reason                                                            | [routes/ai.ts](server/src/routes/ai.ts), [prompts.ts](server/src/ai/prompts.ts), [PlanPanel.svelte](web/src/components/PlanPanel.svelte)                                                        |
| Indoor air hacks                   | A sourced catalogue of 13 hacks (DIY box fan filter, purifier sizing and run times, sealing gaps, clean room, kitchen exhaust, wet mopping and more); the day and household decide which are offered, Gemini picks and tailors them, the server rejects any outside the list | [hacks.ts](packages/core/src/hacks.ts), [schemas.ts](server/src/schemas.ts)                                                                                                                     |
| GenAI assistant                    | Follow-up questions answered by Gemini with the same live air and household context and the plan on screen                                                                                                                                                                   | [AskBox.svelte](web/src/components/AskBox.svelte), [routes/ai.ts](server/src/routes/ai.ts)                                                                                                      |

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
   (`gemini-3.6-flash`, then `gemini-3.5-flash`) with per-model timeouts and an overall deadline;
   an answer that fails the schema or names an unoffered hack counts as a failure.
4. **If Gemini is unavailable** the app says so and offers Retry. It never shows saved or canned
   text in place of a live answer.

## Google services used

| Service                                                                     | Where and why                                                                                                                                                                                       |
| :-------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gemini API** (`gemini-3.6-flash`, `gemini-3.5-flash`) via `@google/genai` | Writes the routine, low-emission tips and tailored hacks as schema-constrained JSON, and answers follow-up questions: [gemini.ts](server/src/ai/gemini.ts), [routes/ai.ts](server/src/routes/ai.ts) |
| **Cloud Run** (asia-south1)                                                 | Hosts the one container that serves the API and the web app: [Dockerfile](Dockerfile)                                                                                                               |
| **Secret Manager**                                                          | Holds the Gemini API key, injected into Cloud Run at deploy                                                                                                                                         |
| **Cloud Build and Artifact Registry**                                       | Build the container from source on deploy                                                                                                                                                           |

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

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint
  `strictTypeChecked` with complexity budgets and zero warnings, Prettier.
- 120 tests (Vitest) with coverage thresholds: the domain core at 100 %, the server at 95 %, and
  every component audited with axe.
- Accessibility: skip link, landmarks, labelled controls, bands named in words (never colour
  alone), a table alternative to the chart, live regions for AI results, visible focus, reduced
  motion, light and dark themes.
- Efficiency: 24 kB of gzipped JavaScript, tree-shakeable core, the outlook recomputed in the
  browser with no request, cached and coalesced upstream calls, compression and immutable
  caching of hashed assets.
- Security: see [SECURITY.md](SECURITY.md).

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
