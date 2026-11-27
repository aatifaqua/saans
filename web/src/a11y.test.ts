import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
// The shipped page and stylesheet themselves, so these checks hold for what users receive.
import html from '../index.html?raw';
import css from './app.css?raw';
import App from './App.svelte';
import { PLACE, PLAN, readings } from '../test/fixtures.ts';

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const start = [`\n\n${selector} {`, `*/\n${selector} {`]
    .map((opening) => css.indexOf(opening))
    .find((index) => index !== -1);
  return start === undefined ? '' : css.slice(start, css.indexOf('}', start));
}

/** The whole app with a place, its forecast and a finished plan on screen. */
async function fullPage(): Promise<HTMLElement> {
  localStorage.setItem('saans', JSON.stringify({ place: PLACE }));
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        Response.json(
          url === '/api/plan'
            ? { plan: PLAN, model: 'm' }
            : { utcOffsetSeconds: 19_800, readings: readings() },
        ),
      ),
    ),
  );
  const { container } = render(App);
  await fireEvent.click(await screen.findByRole('button', { name: "Make today's plan" }));
  await screen.findByText('Quick school drop by car');
  return container;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.parse('2026-11-22T00:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('page document', () => {
  it('declares its language and a descriptive title (WCAG 3.1.1, 2.4.2)', () => {
    expect(html).toContain('<html lang="en">');
    expect(/<title>([^<]+)<\/title>/.exec(html)?.[1]).toMatch(/Saans: .{10,}/);
  });

  it('never stops the visitor zooming (WCAG 1.4.4)', () => {
    const viewport = /<meta\s+name="viewport"\s+content="([^"]+)"/.exec(html)?.[1];
    expect(viewport).toBe('width=device-width, initial-scale=1');
  });

  it('follows the system colour scheme and explains itself without JavaScript', () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toMatch(/<noscript>[^<]+<\/noscript>/);
  });
});

describe('page structure with a plan on screen', () => {
  it('has no axe violations (WCAG 2.2 A and AA rules)', async () => {
    expect(await axe(await fullPage())).toHaveNoViolations();
  });

  it('has exactly one h1 and never skips a heading level (WCAG 1.3.1)', async () => {
    const page = await fullPage();
    const levels = [...page.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) =>
      Number(heading.tagName.slice(1)),
    );
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      expect(level - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1);
    });
  });

  it('keeps all content inside one header, one main and one footer (WCAG 1.3.1)', async () => {
    const page = await fullPage();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect([...page.children].map((child) => child.tagName)).toEqual([
      'A',
      'HEADER',
      'MAIN',
      'FOOTER',
    ]);
  });

  it('starts with a skip link whose target can take focus (WCAG 2.4.1)', async () => {
    const page = await fullPage();
    const first = page.querySelector('a, button, input, select, [tabindex]');
    expect(first).toHaveTextContent('Skip to content');
    expect(first).toHaveAttribute('href', '#main');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    main.focus();
    expect(document.activeElement).toBe(main);
  });

  it('names every section, region and form (WCAG 1.3.1, 4.1.2)', async () => {
    const page = await fullPage();
    for (const part of page.querySelectorAll('section, form, [role="region"], [role="img"]')) {
      expect(part).toHaveAccessibleName();
    }
  });

  it('has unique ids, and every label and ARIA reference resolves (WCAG 4.1.2)', async () => {
    const page = await fullPage();
    const ids = [...page.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const references = [...page.querySelectorAll('[for], [aria-labelledby], [aria-describedby]')]
      .flatMap((element) =>
        ['for', 'aria-labelledby', 'aria-describedby'].map((name) => element.getAttribute(name)),
      )
      .flatMap((value) => (value === null ? [] : value.split(/\s+/)));
    expect(references.length).toBeGreaterThan(10);
    for (const id of references) expect(ids).toContain(id);
  });

  it('uses native controls only, in document order (WCAG 2.1.1, 2.4.3)', async () => {
    const page = await fullPage();
    for (const button of page.querySelectorAll('button')) {
      expect(button).toHaveAttribute('type');
      expect(button).toHaveAccessibleName();
    }
    for (const element of page.querySelectorAll('[tabindex]')) {
      expect(Number(element.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
    }
    expect(page.querySelectorAll('[role="button"], [onclick]')).toHaveLength(0);
  });

  it('gives hints as text, never as placeholders that vanish while typing (WCAG 3.3.2)', async () => {
    const page = await fullPage();
    expect(page.querySelectorAll('[placeholder]')).toHaveLength(0);
    for (const control of page.querySelectorAll('input, select')) {
      expect(control).toHaveAccessibleName();
    }
  });
});

describe('stylesheet', () => {
  it('draws a 3px focus ring and never removes an outline (WCAG 2.4.7)', () => {
    expect(rule(':focus-visible')).toContain('outline: 3px solid var(--focus)');
    expect(css).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it('has nothing fixed or sticky that could cover the focused element (WCAG 2.4.11)', () => {
    expect(css).not.toMatch(/position:\s*(fixed|sticky)/);
  });

  it('sizes every control at 44px or more (WCAG 2.5.8)', () => {
    const inputs = "input[type='number'],\ninput[type='search'],\ninput[type='text'],\nselect";
    for (const selector of ['button', 'button.link', '.check', inputs]) {
      expect(rule(selector)).toContain('min-height: 2.75rem');
    }
  });

  it('sets every font size in rem, none below 12px (WCAG 1.4.4)', () => {
    const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map(([, size = '']) => size);
    expect(sizes.length).toBeGreaterThan(10);
    for (const size of sizes) {
      expect(size).toMatch(/^[\d.]+rem$/);
      expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('has no fixed width that would force sideways scrolling at 320px (WCAG 1.4.10)', () => {
    const widths = [...css.matchAll(/[^-]width:\s*(\d+)px/g)].map(([, px = '']) => Number(px));
    // The only pixel width is the 1px box of visually hidden status text.
    expect(widths).toEqual([1]);
    expect(css).toContain('@media (min-width: 60rem)');
  });

  it('keeps each chart axis label inside its own columns, so none overlap (WCAG 1.4.10)', () => {
    expect(rule('.ticks')).toContain('display: grid');
    expect(rule('.ticks span')).toContain('overflow: hidden');
    expect(rule('.ticks span')).toContain('min-width: 0');
  });

  it('moves nothing unless motion is welcome (WCAG 2.3.3)', () => {
    const gate = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(gate).toBeGreaterThan(-1);
    expect(css.slice(0, gate)).not.toMatch(/transition|animation|scroll-behavior/);
  });

  it('keeps the chart readable in forced colours and never dims a control', () => {
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    expect(forced).toContain('CanvasText');
    expect(forced).toContain('Highlight');
    expect(css).not.toContain('opacity');
  });

  it('marks an invalid field with a thicker border as well as a message (WCAG 1.4.1)', () => {
    expect(rule("input[aria-invalid='true']")).toContain('border: 3px solid');
    expect(rule('.field-error')).toContain('font-weight: 600');
  });
});
