import { describe, expect, it } from 'vitest';
import { groundingContext } from './context.ts';
import { FAMILY, PM25, series } from './test-fixtures.ts';
import { outlook } from './windows.ts';

const MORNING = '2026-11-22T06:00';

describe('groundingContext', () => {
  const day = outlook(series(MORNING, Array<number>(24).fill(PM25.poor)), FAMILY, MORNING);

  it('is compact JSON with only the fields the model needs', () => {
    const context = JSON.parse(groundingContext(FAMILY, day, 'Delhi')) as Record<string, unknown>;
    expect(Object.keys(context).sort()).toEqual([
      'air',
      'allowedHacks',
      'household',
      'notes',
      'place',
    ]);
  });

  it('carries the computed numbers so the model never has to invent them', () => {
    const text = groundingContext(FAMILY, day, 'Delhi');
    expect(text).toContain('"nowAqi":250');
    expect(text).toContain('"threshold":"satisfactory"');
    expect(text).toContain('"leastBad":true');
    expect(text).not.toContain('\n');
  });

  it('reports no current reading when the forecast is empty', () => {
    const empty = outlook([], FAMILY, MORNING);
    expect(groundingContext(FAMILY, empty, 'Delhi')).toContain('"nowAqi":null');
  });
});
