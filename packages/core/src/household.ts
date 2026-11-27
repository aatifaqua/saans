import type { Band, Commute, Household, Note } from './types.ts';

/** Children, older adults, pregnancy or a heart, lung or asthma condition. */
export function isVulnerable(household: Household): boolean {
  const { child, olderAdult, pregnant } = household.members;
  return child + olderAdult + pregnant > 0 || household.sensitivities.length > 0;
}

/**
 * Healthy adults can be outdoors up to Moderate; CPCB health advice says sensitive groups feel
 * effects one band earlier, so a vulnerable member moves the whole household to Satisfactory.
 */
export function householdThreshold(household: Household): Band {
  return isVulnerable(household) ? 'satisfactory' : 'moderate';
}

const COMMUTE_NOTES: Readonly<Record<Commute, Note | null>> = {
  walk: {
    text: 'Walk on side streets rather than main roads, and leave in the cleanest window.',
    why: 'You walk to work or school, and traffic pollution drops sharply a block away from busy roads.',
  },
  cycle: {
    text: 'Cycle on quieter streets at an easy pace and wear a well-fitted N95 on Poor days.',
    why: 'You cycle, and hard breathing on busy roads raises the dose of fine particles.',
  },
  publicTransport: {
    text: 'Prefer the metro over buses and wear a mask on platforms and at stops.',
    why: 'You use public transport, and waiting at roadside stops is the dirtiest part of the trip.',
  },
  twoWheeler: {
    text: 'Wear a well-fitted N95 under the helmet and avoid peak traffic hours.',
    why: 'You ride a two-wheeler, which puts you in the exhaust of the vehicles ahead.',
  },
  car: {
    text: 'No idling, cabin air on recirculate, and combine errands into one trip.',
    why: 'You drive, so this cuts both what your family breathes and what the car emits.',
  },
  none: null,
};

/**
 * Precautions that follow from who lives in the home and how they travel, each with its reason.
 * They are facts given to Gemini as grounding and are never shown on their own.
 */
export function householdNotes(household: Household): readonly Note[] {
  const { members, sensitivities } = household;
  const notes: Note[] = [];
  if (members.child > 0) {
    notes.push({
      text: 'Keep the school run short and move play indoors on Poor or worse days.',
      why: 'Children breathe faster and take in more air for their size.',
    });
  }
  if (members.olderAdult > 0) {
    notes.push({
      text: 'Move morning walks indoors unless the air is Satisfactory or better.',
      why: 'Older adults face higher heart and lung risk from fine particles.',
    });
  }
  if (members.pregnant > 0) {
    notes.push({
      text: 'Limit time outdoors during pregnancy and rest in the cleanest room.',
      why: 'Smog exposure in pregnancy is linked to low birth weight.',
    });
  }
  if (sensitivities.includes('asthma')) {
    notes.push({
      text: 'Carry the reliever inhaler on every outing and follow the asthma action plan.',
      why: 'Smog is a common asthma attack trigger.',
    });
  }
  if (sensitivities.includes('heartOrLung')) {
    notes.push({
      text: 'Avoid exertion outdoors and watch for chest pain or breathlessness.',
      why: 'Fine particles strain the heart and lungs.',
    });
  }
  const commute = COMMUTE_NOTES[household.commute];
  if (commute !== null) notes.push(commute);
  if (household.outdoorExercise) {
    notes.push({
      text: 'Move exercise indoors unless there is a clean window, and keep it light.',
      why: 'You exercise outdoors, and heavy breathing multiplies the dose.',
    });
  }
  return notes;
}
