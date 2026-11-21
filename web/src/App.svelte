<script lang="ts">
  import { DISCLAIMER, localHour, outlook, type Household, type Place } from '@saans/core';
  import AirNow from './components/AirNow.svelte';
  import ForecastStrip from './components/ForecastStrip.svelte';
  import HouseholdForm from './components/HouseholdForm.svelte';
  import PlaceSearch from './components/PlaceSearch.svelte';
  import PlanPanel from './components/PlanPanel.svelte';
  import { ApiError, getAir, type Air } from './lib/api.ts';
  import { browserStorage, loadSaved, save } from './lib/storage.ts';

  const storage = browserStorage();
  const saved = loadSaved(storage);

  let household = $state<Household>(saved.household);
  let place = $state<Place | null>(saved.place);
  let air = $state<Air | null>(null);
  let airError = $state('');

  /** Recomputed in the browser whenever the household changes; no request needed. */
  const day = $derived(
    air === null
      ? null
      : outlook(air.readings, household, localHour(Date.now(), air.utcOffsetSeconds)),
  );

  async function load(target: Place): Promise<void> {
    air = null;
    airError = '';
    try {
      air = await getAir(target);
    } catch (error) {
      airError = error instanceof ApiError ? error.message : 'Live air data is unavailable.';
    }
  }

  $effect(() => {
    save({ household, place }, storage);
  });

  $effect(() => {
    if (place !== null) void load(place);
  });
</script>

<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <h1>Saans <span>Clean-air routines for smoggy days</span></h1>
</header>

<main id="main">
  <div class="column">
    <PlaceSearch
      {place}
      onselect={(next: Place) => {
        place = next;
      }}
    />
    <HouseholdForm
      {household}
      onchange={(next: Household) => {
        household = next;
      }}
    />
  </div>

  <div class="column">
    {#if place === null}
      <p class="card hint">
        Search for your city or use your location to see today's air and get a plan.
      </p>
    {/if}
    {#if airError}
      <div class="card error" role="alert">
        <p>{airError}</p>
        <button
          type="button"
          onclick={() => {
            if (place !== null) void load(place);
          }}>Retry</button
        >
      </div>
    {/if}
    {#if place !== null && day !== null}
      <AirNow {day} {place} />
      <ForecastStrip {day} />
      <PlanPanel {household} {place} />
    {/if}
  </div>
</main>

<footer class="site">
  <p>{DISCLAIMER}</p>
  <p>Air data: Open-Meteo (Copernicus CAMS forecast). Plans and answers: Google Gemini.</p>
</footer>
