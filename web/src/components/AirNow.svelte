<script lang="ts">
  import type { DayOutlook, Place } from '@saans/core';
  import { BAND_LABEL, formatHour } from '../lib/format.ts';

  interface Props {
    day: DayOutlook;
    place: Place;
  }

  let { day, place }: Props = $props();
</script>

<section class="card air" aria-labelledby="air-heading">
  <h2 id="air-heading">Air in {place.name}</h2>
  {#if day.now}
    <div class="now band-{day.now.band}">
      <span class="aqi">{day.now.aqi}</span>
      <span class="band-label">{BAND_LABEL[day.now.band]}</span>
      <span class="muted">Indian National AQI, this hour</span>
    </div>
  {:else}
    <p>No current reading for this place.</p>
  {/if}

  {#if day.episode}
    <p class="warning">Smog episode: the next 24 hours average Very Poor or worse.</p>
  {/if}
  <p>Your household's outdoor limit: <strong>{BAND_LABEL[day.threshold]}</strong></p>

  <h3>Cleanest hours in the next 24</h3>
  {#if day.best.length > 0}
    <ul class="windows">
      {#each day.best as window (window.start)}
        <li>
          <strong>{formatHour(window.start)} to {formatHour(window.end)}</strong>:
          {BAND_LABEL[window.band]}, AQI {window.meanAqi}
          {#if window.leastBad}(the least bad hour, still above your limit){/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p>No daytime readings in the next 24 hours.</p>
  {/if}
  {#if day.worst}
    <p>
      Worst stretch: <strong>{formatHour(day.worst.start)} to {formatHour(day.worst.end)}</strong>,
      {BAND_LABEL[day.worst.band]}. Keep windows shut then.
    </p>
  {/if}
</section>
