import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import App from './App.svelte';
import { PLACE, readings } from './test-fixtures.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.parse('2026-11-22T00:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('asks for a place first', async () => {
    const { container } = render(App);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Saans');
    expect(screen.getByText(/Search for your city/)).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('not medical advice');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('loads live air for the saved place', async () => {
    localStorage.setItem('saans', JSON.stringify({ household: undefined, place: PLACE }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ utcOffsetSeconds: 19_800, readings: readings() })),
      ),
    );
    render(App);
    expect(await screen.findByRole('heading', { name: /Air in Delhi/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Make today's plan" })).toBeInTheDocument();
  });

  it('says when live air data cannot be loaded', async () => {
    localStorage.setItem('saans', JSON.stringify({ place: PLACE }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { error: 'Live air data is unavailable right now. Please retry.' },
            { status: 502 },
          ),
        ),
      ),
    );
    render(App);
    expect(await screen.findByRole('alert')).toHaveTextContent('Live air data is unavailable');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ utcOffsetSeconds: 19_800, readings: readings() })),
      ),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: /Air in Delhi/ })).toBeInTheDocument();
  });

  it('loads air for a newly chosen place and recomputes it for the household', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          Response.json(
            url.startsWith('/api/places')
              ? { places: [{ name: 'Delhi', region: 'Delhi', lat: 28.65, lon: 77.23 }] }
              : { utcOffsetSeconds: 19_800, readings: readings() },
          ),
        ),
      ),
    );
    render(App);
    await fireEvent.input(screen.getByLabelText('City or town'), { target: { value: 'Delhi' } });
    await fireEvent.submit(screen.getByRole('search'));
    await fireEvent.click(await screen.findByRole('button', { name: /Delhi, Delhi/ }));
    expect(await screen.findByText(/outdoor limit/i)).toHaveTextContent('Moderate');
    await fireEvent.input(screen.getByLabelText('Children (under 12)'), { target: { value: '1' } });
    expect(screen.getByText(/outdoor limit/i)).toHaveTextContent('Satisfactory');
    expect(JSON.parse(localStorage.getItem('saans') ?? '{}')).toMatchObject({
      place: { name: 'Delhi' },
    });
  });
});
