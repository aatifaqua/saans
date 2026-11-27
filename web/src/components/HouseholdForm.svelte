<!--
  The household profile. Every change is reported upwards as a whole new household; a count that
  is out of range is corrected and the correction is explained next to its field.
-->
<script lang="ts">
  import {
    COMMUTES,
    MAX_MEMBER_COUNT,
    type Commute,
    type Household,
    type Member,
    type Sensitivity,
  } from '@saans/core';

  interface Props {
    household: Household;
    onchange: (next: Household) => void;
  }

  let { household, onchange }: Props = $props();

  const MEMBER_FIELDS: readonly { key: Member; label: string }[] = [
    { key: 'child', label: 'Children (under 12)' },
    { key: 'adult', label: 'Adults' },
    { key: 'olderAdult', label: 'Older adults (60+)' },
    { key: 'pregnant', label: 'Pregnant' },
  ];

  const CONDITIONS: readonly { key: Sensitivity; label: string }[] = [
    { key: 'asthma', label: 'Asthma' },
    { key: 'heartOrLung', label: 'Heart or lung condition' },
  ];

  const COMMUTE_LABEL: Readonly<Record<Commute, string>> = {
    walk: 'Walk',
    cycle: 'Cycle',
    publicTransport: 'Metro or bus',
    twoWheeler: 'Two-wheeler',
    car: 'Car',
    none: 'Mostly at home',
  };

  const NO_COUNT_ERRORS: Readonly<Record<Member, string>> = {
    child: '',
    adult: '',
    olderAdult: '',
    pregnant: '',
  };

  /** What was wrong with the value just typed into a count field; empty for every other field. */
  let countErrors = $state(NO_COUNT_ERRORS);

  /**
   * Counts are kept in the range the server accepts, and the home always has one person. When
   * the typed value had to be corrected, the field says what was used instead. Any change makes
   * a new household, so a message about an earlier one is dropped rather than left to go stale.
   */
  function setCount(field: { key: Member; label: string }, raw: string): void {
    const { child, adult, olderAdult, pregnant } = household.members;
    const others = child + adult + olderAdult + pregnant - household.members[field.key];
    const lowest = others === 0 ? 1 : 0;
    const typed = raw === '' ? 0 : Number(raw);
    const value = Math.min(MAX_MEMBER_COUNT, Math.max(lowest, Math.trunc(typed) || 0));
    const range = `a whole number from ${String(lowest)} to ${String(MAX_MEMBER_COUNT)}`;
    countErrors = {
      ...NO_COUNT_ERRORS,
      [field.key]:
        typed === value ? '' : `${field.label} must be ${range}. Using ${String(value)}.`,
    };
    onchange({ ...household, members: { ...household.members, [field.key]: value } });
  }

  function setCondition(key: Sensitivity, on: boolean): void {
    const others = household.sensitivities.filter((item) => item !== key);
    onchange({ ...household, sensitivities: on ? [...others, key] : others });
  }

  function setCommute(value: string): void {
    const commute = COMMUTES.find((mode) => mode === value);
    if (commute !== undefined) onchange({ ...household, commute });
  }
</script>

<section class="card" aria-labelledby="home-heading">
  <h2 id="home-heading">Your household</h2>
  <p class="muted">Saved on this device only. It shapes how cautious today's plan is.</p>

  <fieldset>
    <legend>Who lives at home</legend>
    <div class="counts">
      {#each MEMBER_FIELDS as field (field.key)}
        <div class="count">
          <label for="count-{field.key}">{field.label}</label>
          <input
            id="count-{field.key}"
            name={field.key}
            type="number"
            min="0"
            max={MAX_MEMBER_COUNT}
            step="1"
            inputmode="numeric"
            autocomplete="off"
            aria-describedby="count-hint count-{field.key}-error"
            aria-invalid={countErrors[field.key] === '' ? undefined : 'true'}
            value={household.members[field.key]}
            oninput={(event) => {
              setCount(field, event.currentTarget.value);
            }}
          />
          <p id="count-{field.key}-error" class="field-error" aria-live="polite">
            {countErrors[field.key]}
          </p>
        </div>
      {/each}
    </div>
    <p id="count-hint" class="hint">Whole numbers from 0 to {MAX_MEMBER_COUNT}</p>
  </fieldset>

  <fieldset>
    <legend>Health conditions in the family</legend>
    {#each CONDITIONS as condition (condition.key)}
      <label class="check">
        <input
          type="checkbox"
          checked={household.sensitivities.includes(condition.key)}
          onchange={(event) => {
            setCondition(condition.key, event.currentTarget.checked);
          }}
        />
        {condition.label}
      </label>
    {/each}
  </fieldset>

  <label class="field">
    <span>Usual commute</span>
    <select
      name="commute"
      value={household.commute}
      onchange={(event) => {
        setCommute(event.currentTarget.value);
      }}
    >
      {#each COMMUTES as mode (mode)}
        <option value={mode}>{COMMUTE_LABEL[mode]}</option>
      {/each}
    </select>
  </label>

  <label class="check">
    <input
      type="checkbox"
      checked={household.outdoorExercise}
      onchange={(event) => {
        onchange({ ...household, outdoorExercise: event.currentTarget.checked });
      }}
    />
    Someone exercises outdoors
  </label>
  <label class="check">
    <input
      type="checkbox"
      checked={household.hasPurifier}
      onchange={(event) => {
        onchange({ ...household, hasPurifier: event.currentTarget.checked });
      }}
    />
    We have an air purifier
  </label>
</section>
