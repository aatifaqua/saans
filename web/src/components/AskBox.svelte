<script lang="ts">
  import type { Household, Place, Plan } from '@saans/core';
  import { ApiError, askQuestion } from '../lib/api.ts';

  interface Props {
    household: Household;
    place: Place;
    plan: Plan;
  }

  let { household, place, plan }: Props = $props();

  let question = $state('');
  let answer = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    error = '';
    try {
      answer = (await askQuestion(household, place, plan, question.trim())).answer;
    } catch (failure) {
      answer = '';
      error = failure instanceof ApiError ? failure.message : 'Something went wrong.';
    } finally {
      busy = false;
    }
  }
</script>

<form class="ask" aria-label="Follow-up question" onsubmit={submit}>
  <label class="field" for="ask-input"><span>Ask about today</span></label>
  <div class="row">
    <input
      id="ask-input"
      bind:value={question}
      maxlength="500"
      placeholder="Can the children play outside after school?"
    />
    <button type="submit" disabled={busy || question.trim() === ''}>Ask</button>
  </div>
</form>
{#if error}
  <p class="error" role="alert">{error}</p>
{/if}
<div aria-live="polite">
  {#if answer}
    <p class="answer">{answer}</p>
  {/if}
</div>
