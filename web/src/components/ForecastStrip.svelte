<!--
  The 48-hour forecast three ways: a sentence naming its extremes, a bar chart with a time axis and
  a named key, and a table of every hour. None of them depends on colour or on seeing the chart.
-->
<script lang="ts">
  import type { DayOutlook } from '@saans/core';
  import { bandsShown, forecastSummary } from '../lib/chart.ts';
  import { BAND_LABEL, formatDayHour, formatHour } from '../lib/format.ts';

  interface Props {
    day: DayOutlook;
  }

  let { day }: Props = $props();

  /** Bars are scaled against the top of the index, so heights compare across days and cities. */
  const MAX_AQI = 500;
  /** The shortest bar, in percent, so a very clean hour still shows. */
  const MIN_BAR_PERCENT = 4;
  /**
   * The time axis labels one bar in twelve. Four labels across 48 bars leave each about 60 px on
   * a 320 px screen, twice what "12 pm" needs, so labels never touch or run past the chart.
   */
  const HOURS_PER_TICK = 12;

  const inBest = (time: string): boolean =>
    day.best.some((window) => time >= window.start && time < window.end);

  /** One label per run of bars: the hour of its first bar and how many bars it sits under. */
  const ticks = $derived(
    day.hours
      .filter((_, index) => index % HOURS_PER_TICK === 0)
      .map((hour, tick) => ({
        time: hour.time,
        bars: Math.min(HOURS_PER_TICK, day.hours.length - tick * HOURS_PER_TICK),
      })),
  );
</script>

<figure class="card strip">
  <figcaption><h2>Next 48 hours</h2></figcaption>
  <!-- Visible text right before the chart, so it is read once and not repeated as a description. -->
  <p>{forecastSummary(day.hours)}</p>
  <div
    class="bars"
    role="img"
    aria-label="Bar chart of the hourly AQI for the next 48 hours; the table below lists every hour"
  >
    {#each day.hours as hour (hour.time)}
      <div
        class="bar band-{hour.band}"
        class:best={inBest(hour.time)}
        style:height="{Math.max(MIN_BAR_PERCENT, (hour.aqi / MAX_AQI) * 100)}%"
      ></div>
    {/each}
  </div>
  <!-- The table below gives every hour in words, so the axis is for sighted readers only. -->
  <div
    class="ticks"
    aria-hidden="true"
    style:grid-template-columns="repeat({day.hours.length}, minmax(0, 1fr))"
  >
    {#each ticks as tick (tick.time)}
      <span style:grid-column="span {tick.bars}">{formatHour(tick.time)}</span>
    {/each}
  </div>
  <ul class="legend" aria-label="Chart key">
    {#each bandsShown(day.hours) as band (band)}
      <li><span class="key band-{band}"></span>{BAND_LABEL[band]}</li>
    {/each}
    <li><span class="key best"></span>Outlined: your cleanest window today</li>
  </ul>
  <!-- A scrolling region must take keyboard focus, or its rows cannot be reached without a mouse. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="table-scroll" role="region" aria-labelledby="forecast-caption" tabindex="0">
    <table>
      <caption id="forecast-caption">Every hour of the chart, in local time</caption>
      <thead>
        <tr><th scope="col">Hour</th><th scope="col">AQI</th><th scope="col">Band</th></tr>
      </thead>
      <tbody>
        {#each day.hours as hour (hour.time)}
          <tr>
            <th scope="row">{formatDayHour(hour.time)}</th>
            <td>{hour.aqi}</td>
            <td>{BAND_LABEL[hour.band]}{inBest(hour.time) ? ', cleanest window' : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</figure>
