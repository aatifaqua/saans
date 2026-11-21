<script lang="ts">
  import type { DayOutlook } from '@saans/core';
  import { BAND_LABEL, formatDayHour } from '../lib/format.ts';

  interface Props {
    day: DayOutlook;
  }

  let { day }: Props = $props();

  /** Bars are scaled against the top of the index, so heights compare across days and cities. */
  const MAX_AQI = 500;

  const inBest = (time: string): boolean =>
    day.best.some((window) => time >= window.start && time < window.end);
</script>

<figure class="card strip">
  <figcaption><h2>Next 48 hours</h2></figcaption>
  <div
    class="bars"
    role="img"
    aria-label="Hourly AQI bars for the next 48 hours. The table below lists every hour."
  >
    {#each day.hours as hour (hour.time)}
      <div
        class="bar band-{hour.band}"
        class:best={inBest(hour.time)}
        style:height="{Math.max(4, (hour.aqi / MAX_AQI) * 100)}%"
      ></div>
    {/each}
  </div>
  <p class="muted legend"><span class="key best"></span> Your cleanest window today</p>
  <details>
    <summary>Show every hour as a table</summary>
    <table>
      <thead>
        <tr><th scope="col">Hour</th><th scope="col">AQI</th><th scope="col">Band</th></tr>
      </thead>
      <tbody>
        {#each day.hours as hour (hour.time)}
          <tr>
            <td>{formatDayHour(hour.time)}</td>
            <td>{hour.aqi}</td>
            <td>{BAND_LABEL[hour.band]}{inBest(hour.time) ? ', cleanest window' : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>
