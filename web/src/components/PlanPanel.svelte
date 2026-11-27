<script lang="ts">
  import { DISCLAIMER, HACKS, type Household, type Place, type Plan } from '@saans/core';
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

  /** Every plan is written by Gemini on request; on failure nothing stands in for it. */
  async function make(): Promise<void> {
    busy = true;
    error = '';
    try {
      result = await getPlan(household, place);
    } catch (failure) {
      result = null;
      error = failure instanceof ApiError ? failure.message : 'Something went wrong.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="card plan" aria-labelledby="plan-heading" aria-busy={busy}>
  <h2 id="plan-heading">Today's plan</h2>
  <p class="muted">Gemini writes a routine for your household from the live forecast above.</p>
  <button type="button" class="primary" onclick={make} disabled={busy}>
    {busy ? 'Writing your plan' : result ? 'Make a fresh plan' : "Make today's plan"}
  </button>

  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      <button type="button" onclick={make}>Retry</button>
    </div>
  {/if}

  <div aria-live="polite">
    {#if result}
      <p class="summary">{result.plan.summary}</p>

      <h3>Routine</h3>
      <ol class="routine">
        {#each result.plan.routine as step, index (index)}
          <li>
            <span class="time">{step.time}</span>
            <span>{step.action}</span>
            <span class="why">Why: {step.why}</span>
          </li>
        {/each}
      </ol>

      <h3>Cut your own emissions</h3>
      <ul class="tips">
        {#each result.plan.lowEmission as tip, index (index)}
          <li><span>{tip.tip}</span> <span class="why">Why: {tip.why}</span></li>
        {/each}
      </ul>

      <h3>Indoor air hacks</h3>
      <ul class="hacks">
        {#each result.plan.hacks as hack (hack.id)}
          <li>
            <strong>{HACKS[hack.id].title}</strong>
            <span>{hack.how}</span>
            <span class="why">Basis: {HACKS[hack.id].source}</span>
          </li>
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
