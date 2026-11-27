<!--
  Today's plan, written by Gemini on request. Progress is announced from outside the busy section,
  focus moves to the finished plan, and a failure shows an alert with a retry and nothing else.
-->
<script lang="ts">
  import { DISCLAIMER, HACKS, type Household, type Place, type Plan } from '@saans/core';
  import { tick } from 'svelte';
  import { ApiError, getPlan } from '../lib/api.ts';
  import AskBox from './AskBox.svelte';

  interface Props {
    household: Household;
    place: Place;
  }

  let { household, place }: Props = $props();

  let result = $state<{ plan: Plan; model: string } | null>(null);
  let error = $state('');
  let busy = $state(false);
  let summary = $state<HTMLParagraphElement>();

  /** Every plan is written by Gemini on request; on failure nothing stands in for it. */
  async function make(): Promise<void> {
    // The button stays focusable while the plan is written, so a second press is ignored here.
    if (busy) return;
    busy = true;
    error = '';
    try {
      result = await getPlan(household, place);
      busy = false;
      // Move focus to the new plan, so keyboard and screen reader users start reading there.
      await tick();
      summary?.focus();
    } catch (failure) {
      result = null;
      error = failure instanceof ApiError ? failure.message : 'Something went wrong.';
    } finally {
      busy = false;
    }
  }
</script>

<!-- Outside the busy section, so screen readers announce it straight away. -->
<p class="visually-hidden" role="status">
  {busy ? 'Writing your plan.' : result ? "Today's plan is ready." : ''}
</p>
<section class="card plan" aria-labelledby="plan-heading" aria-busy={busy}>
  <h2 id="plan-heading">Today's plan</h2>
  <p class="muted">Gemini writes a routine for your household from the live forecast above.</p>
  <button type="button" class="primary" onclick={make} aria-disabled={busy}>
    {busy ? 'Writing your plan' : result ? 'Make a fresh plan' : "Make today's plan"}
  </button>

  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      <button type="button" onclick={make}>Retry</button>
    </div>
  {/if}

  <div>
    {#if result}
      <p class="summary" tabindex="-1" bind:this={summary}>{result.plan.summary}</p>

      <h3>Low-emission routine</h3>
      <ol class="routine">
        {#each result.plan.routine as step, index (index)}
          <li>
            <span class="time">{step.time}</span>
            <span>{step.action}</span>
            <span class="why">Why: {step.why}</span>
          </li>
        {/each}
      </ol>

      <h3>Sustainable alternatives</h3>
      <ul class="tips">
        {#each result.plan.alternatives as alternative, index (index)}
          <li>
            <span>{alternative.choice}</span>
            <span class="why">Impact: {alternative.impact}</span>
          </li>
        {/each}
      </ul>

      <h3>Indoor air quality hacks</h3>
      <ul class="hacks">
        {#each result.plan.hacks as hack (hack.id)}
          <li>
            <strong>{HACKS[hack.id].title}</strong>
            <span>{hack.how}</span>
            <span class="why">Impact: {hack.impact}</span>
            <span class="why">Basis: {HACKS[hack.id].source}</span>
          </li>
        {/each}
      </ul>

      <h3>For your community</h3>
      <ul class="tips">
        {#each result.plan.community as step, index (index)}
          <li><span>{step.action}</span> <span class="why">Impact: {step.impact}</span></li>
        {/each}
      </ul>

      <p class="credit muted">Written live by Google Gemini ({result.model}). {DISCLAIMER}</p>
      <!-- A fresh plan starts a fresh conversation, so an old answer never sits under it. -->
      {#key result}
        <AskBox {household} {place} plan={result.plan} />
      {/key}
    {/if}
  </div>
</section>
