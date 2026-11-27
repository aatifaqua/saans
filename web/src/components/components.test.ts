import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { DAY, HOUSEHOLD, PLACE, PLAN } from '../../test/fixtures.ts';
import AirNow from './AirNow.svelte';
import AskBox from './AskBox.svelte';
import ForecastStrip from './ForecastStrip.svelte';
import HouseholdForm from './HouseholdForm.svelte';
import PlaceSearch from './PlaceSearch.svelte';
import PlanPanel from './PlanPanel.svelte';

function answer(body: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body, { status }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HouseholdForm', () => {
  it('reports each change as a new household and has no accessibility violations', async () => {
    const onchange = vi.fn();
    const { container } = render(HouseholdForm, { household: HOUSEHOLD, onchange });
    await fireEvent.click(screen.getByLabelText('Heart or lung condition'));
    expect(onchange).toHaveBeenLastCalledWith({
      ...HOUSEHOLD,
      sensitivities: ['asthma', 'heartOrLung'],
    });
    await fireEvent.input(screen.getByLabelText('Older adults (60+)'), { target: { value: '2' } });
    expect(onchange).toHaveBeenLastCalledWith({
      ...HOUSEHOLD,
      members: { ...HOUSEHOLD.members, olderAdult: 2 },
    });
    await fireEvent.change(screen.getByLabelText('Usual commute'), { target: { value: 'cycle' } });
    expect(onchange).toHaveBeenLastCalledWith({ ...HOUSEHOLD, commute: 'cycle' });
    await fireEvent.click(screen.getByLabelText('We have an air purifier'));
    expect(onchange).toHaveBeenLastCalledWith({ ...HOUSEHOLD, hasPurifier: true });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('describes the allowed range of every count field', () => {
    render(HouseholdForm, { household: HOUSEHOLD, onchange: vi.fn() });
    expect(screen.getByLabelText('Adults')).toHaveAccessibleDescription('0 to 12');
  });

  it('reports outdoor exercise and treats a cleared count as zero', async () => {
    const onchange = vi.fn();
    render(HouseholdForm, { household: HOUSEHOLD, onchange });
    await fireEvent.click(screen.getByLabelText('Someone exercises outdoors'));
    expect(onchange).toHaveBeenLastCalledWith({ ...HOUSEHOLD, outdoorExercise: true });
    await fireEvent.input(screen.getByLabelText('Children (under 12)'), { target: { value: '' } });
    expect(onchange).toHaveBeenLastCalledWith({
      ...HOUSEHOLD,
      members: { ...HOUSEHOLD.members, child: 0 },
    });
  });

  it('never lets the household drop to zero people', async () => {
    const onchange = vi.fn();
    const alone = { ...HOUSEHOLD, members: { child: 0, adult: 2, olderAdult: 0, pregnant: 0 } };
    render(HouseholdForm, { household: alone, onchange });
    await fireEvent.input(screen.getByLabelText('Adults'), { target: { value: '0' } });
    expect(onchange).toHaveBeenLastCalledWith({
      ...alone,
      members: { ...alone.members, adult: 1 },
    });
  });

  it('removes a condition when it is unticked and keeps counts in range', async () => {
    const onchange = vi.fn();
    render(HouseholdForm, { household: HOUSEHOLD, onchange });
    await fireEvent.click(screen.getByLabelText('Asthma'));
    expect(onchange).toHaveBeenLastCalledWith({ ...HOUSEHOLD, sensitivities: [] });
    await fireEvent.input(screen.getByLabelText('Adults'), { target: { value: '99' } });
    expect(onchange).toHaveBeenLastCalledWith({
      ...HOUSEHOLD,
      members: { ...HOUSEHOLD.members, adult: 12 },
    });
  });
});

describe('PlaceSearch', () => {
  it('lists Indian matches and selects one', async () => {
    answer({ places: [{ name: 'Lucknow', region: 'Uttar Pradesh', lat: 26.85, lon: 80.95 }] });
    const onselect = vi.fn();
    const { container } = render(PlaceSearch, { place: null, onselect });
    await fireEvent.input(screen.getByLabelText('City or town'), { target: { value: 'Luck' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('1 place found.')).toBeInTheDocument();
    await fireEvent.click(await screen.findByRole('button', { name: /Lucknow, Uttar Pradesh/ }));
    expect(onselect).toHaveBeenCalledWith({ name: 'Lucknow', lat: 26.85, lon: 80.95 });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Where you live' }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says so when nothing in India matches, and reports a failed search', async () => {
    answer({ places: [] });
    render(PlaceSearch, { place: PLACE, onselect: vi.fn() });
    await fireEvent.input(screen.getByLabelText('City or town'), { target: { value: 'Paris' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('No Indian city or town found.')).toBeInTheDocument();
    answer({ error: 'Search for a city name of 2 to 60 characters.' }, 400);
    await fireEvent.submit(screen.getByRole('search'));
    expect(
      await screen.findByText('Search for a city name of 2 to 60 characters.'),
    ).toBeInTheDocument();
  });

  it('uses the device location, rounded to about a kilometre', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok({ coords: { latitude: 28.61394, longitude: 77.20902 } } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const onselect = vi.fn();
    render(PlaceSearch, { place: null, onselect });
    await fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(onselect).toHaveBeenCalledWith({ name: 'Your location', lat: 28.61, lon: 77.21 });
  });

  it('explains when location is refused', async () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail: PositionErrorCallback) => {
      fail({ code: 1 } as GeolocationPositionError);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    render(PlaceSearch, { place: null, onselect: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByText(/Location is off/)).toBeInTheDocument();
  });
});

describe('AirNow edge cases', () => {
  it('says so when there is no reading, no daytime window and no worst stretch', () => {
    const empty = { ...DAY, now: null, best: [], worst: null, episode: false };
    render(AirNow, { day: empty, place: PLACE });
    expect(screen.getByText('No current reading for this place.')).toBeInTheDocument();
    expect(screen.getByText('No daytime readings in the next 24 hours.')).toBeInTheDocument();
    expect(screen.queryByText(/Smog episode/)).not.toBeInTheDocument();
  });

  it('does not call a window least bad when it is within the limit', () => {
    const clean = { ...DAY, best: DAY.best.map((window) => ({ ...window, leastBad: false })) };
    render(AirNow, { day: clean, place: PLACE });
    expect(screen.queryByText(/least bad/)).not.toBeInTheDocument();
  });
});

describe('AirNow and ForecastStrip', () => {
  it('names the band in words and states the household limit', async () => {
    const { container } = render(AirNow, { day: DAY, place: PLACE });
    expect(screen.getByText(/Computed from the live Open-Meteo forecast/)).toBeInTheDocument();
    expect(screen.queryByText(/Keep windows shut/)).not.toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getAllByText('Very Poor').length).toBeGreaterThan(0);
    expect(screen.getByText(/outdoor limit/i)).toHaveTextContent('Satisfactory');
    expect(screen.getByText(/smog episode/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws 48 hours with a table alternative and marks the best window', async () => {
    const { container } = render(ForecastStrip, { day: DAY });
    expect(container.querySelectorAll('.bar')).toHaveLength(48);
    expect(container.querySelectorAll('.bar.best')).toHaveLength(1);
    expect(screen.getAllByRole('row')).toHaveLength(49);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PlanPanel and AskBox', () => {
  it('shows the Gemini plan with hack titles, then answers a follow-up', async () => {
    answer({ plan: PLAN, model: 'gemini-3.6-flash', disclaimer: 'd' });
    const { container } = render(PlanPanel, { household: HOUSEHOLD, place: PLACE });
    await fireEvent.click(screen.getByRole('button', { name: "Make today's plan" }));
    expect(await screen.findByText('Quick school drop by car')).toBeInTheDocument();
    expect(screen.getByText(/Close windows during the worst hours/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-3.6-flash/)).toBeInTheDocument();
    expect(screen.getByText("Today's plan is ready.")).toBeInTheDocument();
    expect(container.querySelector('[aria-busy]')).toBeNull();
    for (const heading of [
      'Low-emission routine',
      'Sustainable alternatives',
      'Indoor air quality hacks',
      'For your community',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Metro instead of the car')).toBeInTheDocument();
    expect(screen.getByText('Impact: Cleaner air for every child')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    answer({ answer: 'Yes, between 2 and 5 PM with a mask.', model: 'm', disclaimer: 'd' });
    await fireEvent.input(screen.getByLabelText('Ask about today'), {
      target: { value: 'Can we go to the park?' },
    });
    await fireEvent.submit(screen.getByRole('form', { name: 'Follow-up question' }));
    const shown = await screen.findByText('Yes, between 2 and 5 PM with a mask.');
    expect(shown.closest('[aria-live]')).toHaveTextContent('not medical advice');
    expect(await axe(container)).toHaveNoViolations();

    answer({ plan: PLAN, model: 'gemini-3.6-flash', disclaimer: 'd' });
    await fireEvent.click(screen.getByRole('button', { name: 'Make a fresh plan' }));
    await waitFor(() => {
      expect(screen.queryByText('Yes, between 2 and 5 PM with a mask.')).not.toBeInTheDocument();
    });
  });

  it('offers a retry and shows no plan when the AI is unavailable', async () => {
    answer({ error: 'The AI assistant is unavailable right now. Please retry.' }, 503);
    const { container } = render(PlanPanel, { household: HOUSEHOLD, place: PLACE });
    await fireEvent.click(screen.getByRole('button', { name: "Make today's plan" }));
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.queryByText('Quick school drop by car')).not.toBeInTheDocument();
    answer({ plan: PLAN, model: 'm', disclaimer: 'd' });
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByText('Quick school drop by car')).toBeInTheDocument();
    });
  });

  it('keeps the Ask button disabled until there is a question, and reports failures', async () => {
    render(AskBox, { household: HOUSEHOLD, place: PLACE, plan: PLAN });
    const button = screen.getByRole('button', { name: 'Ask' });
    expect(button).toBeDisabled();
    answer({ error: 'Too many requests. Please wait a minute.' }, 429);
    await fireEvent.input(screen.getByLabelText('Ask about today'), { target: { value: 'Run?' } });
    expect(button).toBeEnabled();
    await fireEvent.submit(screen.getByRole('form', { name: 'Follow-up question' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  });
});
