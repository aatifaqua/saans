<!--
  Choosing the place: a city search, or the device location rounded to about a kilometre. Progress
  and results are announced through one status region; a query too short to search is reported on
  the field.
-->
<script lang="ts">
  import { round2, type ListedPlace, type Place } from '@saans/core';
  import { ApiError, searchPlaces } from '../lib/api.ts';
  import { formatCoordinates } from '../lib/format.ts';

  interface Props {
    place: Place | null;
    onselect: (place: Place) => void;
  }

  let { place, onselect }: Props = $props();

  let query = $state('');
  let results = $state<readonly ListedPlace[]>([]);
  let status = $state('');
  let busy = $state(false);
  /** What is wrong with the query field itself; empty when it can be searched. */
  let fieldError = $state('');
  let input = $state<HTMLInputElement>();

  /** The shortest and longest query the server accepts. */
  const MIN_QUERY = 2;
  const MAX_QUERY = 60;
  let heading = $state<HTMLHeadingElement>();

  const found = (count: number): string =>
    `${String(count)} ${count === 1 ? 'place' : 'places'} found.`;

  async function search(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    // The button stays focusable while a search runs, so a second press is ignored here.
    if (busy) return;
    const text = query.trim();
    fieldError =
      text.length < MIN_QUERY ? `Type at least ${String(MIN_QUERY)} letters of the name.` : '';
    if (fieldError !== '') {
      // Matches for an earlier search do not answer what is in the field now.
      results = [];
      status = '';
      input?.focus();
      return;
    }
    busy = true;
    status = 'Searching';
    try {
      results = await searchPlaces(text);
      status = results.length === 0 ? 'No Indian city or town found.' : found(results.length);
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
    // The chosen button disappears; keep keyboard focus in this section.
    heading?.focus();
  }

  function locate(): void {
    status = 'Finding your location';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        status = '';
        const { latitude, longitude } = position.coords;
        const [lat, lon] = [round2(latitude), round2(longitude)];
        onselect({ name: `${formatCoordinates(lat, lon)} (your location)`, lat, lon });
      },
      () => {
        status = 'Location is off or unavailable. Search for your city instead.';
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  }
</script>

<section class="card" aria-labelledby="place-heading">
  <h2 id="place-heading" tabindex="-1" bind:this={heading}>Where you live</h2>
  {#if place}
    <p class="muted">Showing air for <strong>{place.name}</strong>.</p>
  {/if}
  <form role="search" aria-label="Find your city" novalidate onsubmit={search}>
    <label class="field" for="place-query"><span>City or town</span></label>
    <p id="place-hint" class="hint">A city or town in India, for example Lucknow.</p>
    <div class="row">
      <input
        id="place-query"
        name="q"
        type="search"
        bind:this={input}
        bind:value={query}
        minlength={MIN_QUERY}
        maxlength={MAX_QUERY}
        required
        autocomplete="address-level2"
        aria-describedby="place-hint place-error"
        aria-invalid={fieldError === '' ? undefined : 'true'}
        oninput={() => {
          if (query.trim().length >= MIN_QUERY) fieldError = '';
        }}
      />
      <button type="submit" aria-disabled={busy}>{busy ? 'Searching' : 'Search'}</button>
    </div>
    <p id="place-error" class="field-error" aria-live="polite">{fieldError}</p>
  </form>
  <button type="button" class="link" onclick={locate}>Use my location</button>
  <p class="status" role="status">{status}</p>
  {#if results.length > 0}
    <ul class="results" aria-label="Matching places">
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
