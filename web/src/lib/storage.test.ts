import { describe, expect, it } from 'vitest';
import { DEFAULT_HOUSEHOLD, loadSaved, save } from './storage.ts';

function memory(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: () => null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('storage', () => {
  it('starts with the default household and no place', () => {
    expect(loadSaved(memory())).toEqual({ household: DEFAULT_HOUSEHOLD, place: null });
  });

  it('round-trips a saved household and place', () => {
    const storage = memory();
    const saved = {
      household: {
        ...DEFAULT_HOUSEHOLD,
        commute: 'car' as const,
        sensitivities: ['asthma' as const],
      },
      place: { name: 'Lucknow', lat: 26.85, lon: 80.95 },
    };
    save(saved, storage);
    expect(loadSaved(storage)).toEqual(saved);
  });

  it('ignores corrupt or outdated data', () => {
    expect(loadSaved(memory({ saans: '{not json' }))).toEqual({
      household: DEFAULT_HOUSEHOLD,
      place: null,
    });
    const outdated = JSON.stringify({ household: { members: {} }, place: { name: 3 } });
    expect(loadSaved(memory({ saans: outdated }))).toEqual({
      household: DEFAULT_HOUSEHOLD,
      place: null,
    });
  });

  it('ignores a saved household with nobody in it', () => {
    const empty = {
      ...DEFAULT_HOUSEHOLD,
      members: { child: 0, adult: 0, olderAdult: 0, pregnant: 0 },
    };
    expect(loadSaved(memory({ saans: JSON.stringify({ household: empty, place: null }) }))).toEqual(
      {
        household: DEFAULT_HOUSEHOLD,
        place: null,
      },
    );
  });

  it('works when storage is unavailable', () => {
    expect(loadSaved(null)).toEqual({ household: DEFAULT_HOUSEHOLD, place: null });
    expect(() => {
      save({ household: DEFAULT_HOUSEHOLD, place: null }, null);
    }).not.toThrow();
  });

  it('keeps going when the browser refuses to store', () => {
    const full = memory();
    full.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => {
      save({ household: DEFAULT_HOUSEHOLD, place: null }, full);
    }).not.toThrow();
  });
});
