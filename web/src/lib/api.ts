import { HACK_IDS, type HourReading, type Household, type Place, type Plan } from '@saans/core';
import { isPlace, isRecord } from './storage.ts';

/** A failed call, with the server's own short message; status 0 means the network failed. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Air {
  readonly utcOffsetSeconds: number;
  readonly readings: readonly HourReading[];
}

export type ListedPlace = Place & { readonly region: string };

const isText = (value: unknown): value is string => typeof value === 'string';

/** Every item is an object whose `keys` are all strings. */
const allHaveText = (value: unknown, keys: readonly string[]): boolean =>
  Array.isArray(value) &&
  value.every((item) => isRecord(item) && keys.every((key) => isText(item[key])));

/** A light shape check: the server already validated the plan against its full schema. */
function isPlan(value: unknown): value is Plan {
  return (
    isRecord(value) &&
    isText(value.summary) &&
    allHaveText(value.routine, ['time', 'action', 'why']) &&
    allHaveText(value.lowEmission, ['tip', 'why']) &&
    allHaveText(value.hacks, ['id', 'how']) &&
    Array.isArray(value.hacks) &&
    value.hacks.every((hack) => isRecord(hack) && HACK_IDS.some((id) => id === hack.id))
  );
}

const isListedPlace = (value: unknown): value is ListedPlace =>
  isPlace(value) && isRecord(value) && isText(value.region);

/** One request, one JSON body; the API is on this origin, so paths are relative. */
async function call(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const init: RequestInit =
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        };
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('You seem to be offline. Check the connection and retry.', 0);
  }
  const json: unknown = await res.json().catch(() => null);
  const data = isRecord(json) ? json : {};
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : 'Something went wrong.';
    throw new ApiError(message, res.status);
  }
  return data;
}

function unexpected(): ApiError {
  return new ApiError('The server sent an unexpected answer. Please retry.', 200);
}

export async function searchPlaces(query: string): Promise<readonly ListedPlace[]> {
  const { places } = await call(`/api/places?q=${encodeURIComponent(query)}`);
  if (!Array.isArray(places)) throw unexpected();
  return places.filter(isListedPlace);
}

export async function getAir(place: Place): Promise<Air> {
  const data = await call(`/api/air?lat=${String(place.lat)}&lon=${String(place.lon)}`);
  const { utcOffsetSeconds, readings } = data;
  if (typeof utcOffsetSeconds !== 'number' || !Array.isArray(readings)) throw unexpected();
  return { utcOffsetSeconds, readings };
}

export async function getPlan(
  household: Household,
  place: Place,
): Promise<{ plan: Plan; model: string }> {
  const { plan, model } = await call('/api/plan', { household, place });
  if (!isPlan(plan) || !isText(model)) throw unexpected();
  return { plan, model };
}

export async function askQuestion(
  household: Household,
  place: Place,
  plan: Plan,
  question: string,
): Promise<{ answer: string; model: string }> {
  const { answer, model } = await call('/api/ask', { household, place, plan, question });
  if (!isText(answer) || !isText(model)) throw unexpected();
  return { answer, model };
}
