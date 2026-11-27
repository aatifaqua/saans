<!--
  One follow-up question about today's plan, answered live by Gemini. A missing question is
  reported on the field itself; a failed request is an alert; the answer arrives in a live region.
-->
<script lang="ts">
  import { DISCLAIMER, type Household, type Place, type Plan } from '@saans/core';
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
  /** What is wrong with the question field itself; empty when it can be sent. */
  let fieldError = $state('');
  let busy = $state(false);
  let input = $state<HTMLInputElement>();

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    // The button stays focusable while a request runs, so a second press is ignored here.
    if (busy) return;
    const text = question.trim();
    fieldError = text === '' ? 'Type a question before asking.' : '';
    if (fieldError !== '') {
      // A failure message from an earlier question no longer describes what is on screen.
      error = '';
      input?.focus();
      return;
    }
    busy = true;
    error = '';
    try {
      answer = (await askQuestion(household, place, plan, text)).answer;
    } catch (failure) {
      answer = '';
      error = failure instanceof ApiError ? failure.message : 'Something went wrong.';
    } finally {
      busy = false;
    }
  }
</script>

<form class="ask" aria-label="Follow-up question" novalidate onsubmit={submit}>
  <label class="field" for="ask-input"><span>Ask about today</span></label>
  <p id="ask-hint" class="hint">For example: Can the children play outside after school?</p>
  <div class="row">
    <input
      id="ask-input"
      name="question"
      type="text"
      bind:this={input}
      bind:value={question}
      maxlength="500"
      required
      autocomplete="off"
      aria-describedby="ask-hint ask-error"
      aria-invalid={fieldError === '' ? undefined : 'true'}
      oninput={() => {
        if (question.trim() !== '') fieldError = '';
      }}
    />
    <button type="submit" aria-disabled={busy}>{busy ? 'Asking' : 'Ask'}</button>
  </div>
  <p id="ask-error" class="field-error" aria-live="polite">{fieldError}</p>
</form>
{#if error}
  <p class="error" role="alert">{error}</p>
{/if}
<p class="visually-hidden" role="status">{busy ? 'Asking Gemini.' : ''}</p>
<div aria-live="polite">
  {#if answer}
    <div class="answer">
      <p>{answer}</p>
      <p class="credit muted">{DISCLAIMER}</p>
    </div>
  {/if}
</div>
