import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { DAY } from '../../test/fixtures.ts';
import ForecastStrip from './ForecastStrip.svelte';

describe('ForecastStrip', () => {
  it('draws 48 hours with a table alternative and marks the best window', async () => {
    const { container } = render(ForecastStrip, { day: DAY });
    expect(container.querySelectorAll('.bar')).toHaveLength(48);
    expect(container.querySelectorAll('.bar.best')).toHaveLength(1);
    expect(screen.getAllByRole('row')).toHaveLength(49);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('states the extremes of the chart in visible words, read once', () => {
    render(ForecastStrip, { day: DAY });
    const chart = screen.getByRole('img', { name: /Bar chart of the hourly AQI/ });
    const summary = screen.getByText(
      'Cleanest hour: Sun 2 pm, AQI 150, Moderate. Most polluted hour: Sun 6 am, AQI 350, Very Poor.',
    );
    expect(summary).toBeVisible();
    // The sentence comes right before the chart; describing the chart with it would repeat it.
    expect(summary.nextElementSibling).toBe(chart);
    expect(chart).not.toHaveAttribute('aria-describedby');
  });

  it('shows the table without anything to open, in a region the keyboard can scroll', () => {
    const { container } = render(ForecastStrip, { day: DAY });
    expect(container.querySelector('details')).toBeNull();
    const region = screen.getByRole('region', { name: /Every hour of the chart/ });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('table')).toBeVisible();
    expect(
      within(region)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Hour', 'AQI', 'Band']);
    expect(within(region).getAllByRole('rowheader')).toHaveLength(48);
    expect(
      within(region).getByRole('row', { name: /Sun 2 pm 150 Moderate, cleanest window/ }),
    ).toBeInTheDocument();
  });

  it('names every band colour in a key', () => {
    render(ForecastStrip, { day: DAY });
    const key = screen.getByRole('list', { name: 'Chart key' });
    expect(
      within(key)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Moderate', 'Very Poor', 'Outlined: your cleanest window today']);
  });

  it('labels the time axis every 12 hours, each label spanning the bars it covers', () => {
    const { container } = render(ForecastStrip, { day: DAY });
    const axis = container.querySelector<HTMLElement>('.ticks');
    expect(axis?.style.gridTemplateColumns).toBe('repeat(48, minmax(0, 1fr))');
    const ticks = [...container.querySelectorAll<HTMLElement>('.ticks span')];
    expect(ticks.map((tick) => tick.textContent)).toEqual(['6 am', '6 pm', '6 am', '6 pm']);
    expect(ticks.map((tick) => tick.style.gridColumn)).toEqual([
      'span 12',
      'span 12',
      'span 12',
      'span 12',
    ]);
  });

  it('gives a short last stretch of the axis only the bars it has', () => {
    const { container } = render(ForecastStrip, { day: { ...DAY, hours: DAY.hours.slice(0, 15) } });
    const ticks = [...container.querySelectorAll<HTMLElement>('.ticks span')];
    expect(ticks.map((tick) => tick.style.gridColumn)).toEqual(['span 12', 'span 3']);
  });
});
