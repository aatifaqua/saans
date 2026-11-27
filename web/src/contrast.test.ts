import { describe, expect, it } from 'vitest';
// The shipped stylesheet itself, so the test checks the colours users actually see.
import css from './app.css?raw';

function tokens(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name = '', hex = '']) => [
      name,
      hex,
    ]),
  );
}

const light = tokens(
  css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme')),
);
const dark = new Map([
  ...light,
  ...tokens(css.slice(css.indexOf('@media (prefers-color-scheme'), css.indexOf('*,'))),
]);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(theme: Map<string, string>, a: string, b: string): number {
  const [high, low] = [luminance(theme.get(a) ?? ''), luminance(theme.get(b) ?? '')].sort(
    (x, y) => y - x,
  );
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

const TEXT_PAIRS = [
  ['ink', 'surface'],
  ['ink', 'bg'],
  ['muted', 'surface'],
  ['muted', 'bg'],
  ['accent', 'surface'],
  ['accent-ink', 'accent'],
  ['warn-ink', 'warn-bg'],
  ['warn-ink', 'surface'],
] as const;

/** Boundaries a user must see to find a control: field edges and the focus ring. */
const EDGE_PAIRS = [
  ['field', 'surface'],
  ['field', 'bg'],
  ['focus', 'surface'],
  ['focus', 'bg'],
] as const;

const BANDS = ['good', 'satisfactory', 'moderate', 'poor', 'very-poor', 'severe'] as const;

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, theme) => {
  it.each(TEXT_PAIRS)('text %s on %s meets 4.5:1 (WCAG 1.4.3)', (text, background) => {
    expect(ratio(theme, text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(EDGE_PAIRS)('edge %s on %s meets 3:1 (WCAG 1.4.11)', (edge, background) => {
    expect(ratio(theme, edge, background)).toBeGreaterThanOrEqual(3);
  });

  it.each(BANDS)('band %s meets 3:1 against the card (WCAG 1.4.11)', (band) => {
    expect(ratio(theme, band, 'surface')).toBeGreaterThanOrEqual(3);
  });
});
