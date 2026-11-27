import {
  COMMUTES,
  MEMBERS,
  SENSITIVITIES,
  type Commute,
  type Household,
  type Place,
  type Sensitivity,
} from '@saans/core';

/** The profile lives only in this browser; it is sent to the server per request, never stored there. */
const KEY = 'saans';

/** Two adults who use public transport: the starting profile. */
export const DEFAULT_HOUSEHOLD: Household = {
  members: { child: 0, adult: 2, olderAdult: 0, pregnant: 0 },
  sensitivities: [],
  commute: 'publicTransport',
  outdoorExercise: false,
  hasPurifier: false,
};

/** What this browser remembers between visits. */
export interface Saved {
  readonly household: Household;
  readonly place: Place | null;
}

/** True for a plain object, the first check before reading any field. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 12;
const isCommute = (value: unknown): value is Commute => COMMUTES.some((mode) => mode === value);
const isSensitivity = (value: unknown): value is Sensitivity =>
  SENSITIVITIES.some((item) => item === value);

function isHousehold(value: unknown): value is Household {
  if (!isRecord(value) || !isRecord(value.members)) return false;
  const { members } = value;
  return (
    MEMBERS.every((member) => isCount(members[member])) &&
    MEMBERS.some((member) => members[member] !== 0) &&
    Array.isArray(value.sensitivities) &&
    value.sensitivities.every(isSensitivity) &&
    isCommute(value.commute) &&
    typeof value.outdoorExercise === 'boolean' &&
    typeof value.hasPurifier === 'boolean'
  );
}

/** True for a value shaped like a Place. */
export const isPlace = (value: unknown): value is Place =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.lat === 'number' &&
  typeof value.lon === 'number';

/** Local storage, or null where the browser blocks it (private modes, strict settings). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** What was saved last time; anything missing, corrupt or from an older shape is replaced by defaults. */
export function loadSaved(storage: Storage | null): Saved {
  const parsed = parseJson(storage?.getItem(KEY) ?? 'null');
  const record = isRecord(parsed) ? parsed : {};
  return {
    household: isHousehold(record.household) ? record.household : DEFAULT_HOUSEHOLD,
    place: isPlace(record.place) ? record.place : null,
  };
}

/** Saving is a convenience: a full or blocked storage never breaks the app. */
export function save(saved: Saved, storage: Storage | null): void {
  try {
    storage?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Nothing to do: the profile simply is not remembered.
  }
}
