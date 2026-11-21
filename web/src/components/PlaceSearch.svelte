<script lang="ts">
  import type { Place } from '@saans/core';
  import { ApiError, searchPlaces, type ListedPlace } from '../lib/api.ts';

  interface Props {
    place: Place | null;
    onselect: (place: Place) => void;
  }

  let { place, onselect }: Props = $props();

  let query = $state('');
  let results = $state<readonly ListedPlace[]>([]);
  let status = $state('');
  let busy = $state(false);

  /** About 1 km: precise enough for city air, and it avoids sending an exact home position. */
  const round2 = (value: number): number => Math.round(value * 100) / 100;

  async function search(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    status = 'Searching';
    try {
      results = await searchPlaces(query.trim());
      status = results.length === 0 ? 'No Indian city or town found.' : '';
    } catch (error) {
      results = [];
      status = error instanceof ApiError ? error.message : 'Search failed. Please retry.';
    } finally {
      busy = false;
    }
  }

  function choose(choice: ListedPlace): void {
    results = [];
    status = '';
    onselect({ name: choice.name, lat: choice.lat, lon: choice.lon });
  }

  function locate(): void {
    status = 'Finding your location';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        status = '';
        const { latitude, longitude } = position.coords;
        onselect({ name: 'Your location', lat: round2(latitude), lon: round2(longitude) });
      },
      () => {
        status = 'Location is off or unavailable. Search for your city instead.';
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  }
</script>

<section class="card" aria-labelledby="place-heading">
  <h2 id="place-heading">Where you live</h2>
  {#if place}
    <p class="muted">Showing air for <strong>{place.name}</strong>.</p>
  {/if}
  <form role="search" aria-label="Find your city" onsubmit={search}>
    <label class="field" for="place-query"><span>City or town</span></label>
    <div class="row">
      <input
        id="place-query"
        type="search"
        bind:value={query}
        minlength="2"
        maxlength="60"
        autocomplete="address-level2"
        placeholder="e.g. Lucknow"
      />
      <button type="submit" disabled={busy}>Search</button>
    </div>
  </form>
  <button type="button" class="link" onclick={locate}>Use my location</button>
  <p class="status" role="status">{status}</p>
  {#if results.length > 0}
    <ul class="results">
      {#each results as result, index (index)}
        <li>
          <button
            type="button"
            onclick={() => {
              choose(result);
            }}
          >
            {result.name}{result.region === '' ? '' : `, ${result.region}`}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
