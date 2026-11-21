<script lang="ts">
  import {
    COMMUTES,
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

  /** Counts are clamped to 0 to 12, the same range the server accepts. */
  function setCount(key: Member, raw: string): void {
    const value = Math.min(12, Math.max(0, Math.trunc(Number(raw)) || 0));
    onchange({ ...household, members: { ...household.members, [key]: value } });
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
        <label class="count">
          <span>{field.label}</span>
          <input
            type="number"
            min="0"
            max="12"
            inputmode="numeric"
            value={household.members[field.key]}
            oninput={(event) => {
              setCount(field.key, event.currentTarget.value);
            }}
          />
        </label>
      {/each}
    </div>
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
