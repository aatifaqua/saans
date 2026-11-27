import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PLACE, stubFetch } from '../../test/fixtures.ts';
import PlaceSearch from './PlaceSearch.svelte';

/** A complete position, as a browser reports it. */
function position(latitude: number, longitude: number): GeolocationPosition {
  const coords: GeolocationCoordinates = {
    latitude,
    longitude,
    accuracy: 20,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({ latitude, longitude }),
  };
  return { coords, timestamp: 0, toJSON: () => ({ coords }) };
}

/** The error a browser reports when the user refuses location access. */
const DENIED: GeolocationPositionError = {
  code: 1,
  message: 'User denied Geolocation',
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlaceSearch', () => {
  it('lists Indian matches and selects one', async () => {
    stubFetch({ places: [{ name: 'Lucknow', region: 'Uttar Pradesh', lat: 26.85, lon: 80.95 }] });
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
    stubFetch({ places: [] });
    render(PlaceSearch, { place: PLACE, onselect: vi.fn() });
    await fireEvent.input(screen.getByLabelText('City or town'), { target: { value: 'Paris' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('No Indian city or town found.')).toBeInTheDocument();
    stubFetch({ error: 'Search for a city name of 2 to 60 characters.' }, 400);
    await fireEvent.submit(screen.getByRole('search'));
    expect(
      await screen.findByText('Search for a city name of 2 to 60 characters.'),
    ).toBeInTheDocument();
  });

  it('uses the device location, rounded to about a kilometre', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok(position(28.61394, 77.20902));
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const onselect = vi.fn();
    render(PlaceSearch, { place: null, onselect });
    await fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(onselect).toHaveBeenCalledWith({
      name: '28.61° N, 77.21° E (your location)',
      lat: 28.61,
      lon: 77.21,
    });
  });

  it('explains when location is refused', async () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail: PositionErrorCallback) => {
      fail(DENIED);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    render(PlaceSearch, { place: null, onselect: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByText(/Location is off/)).toBeInTheDocument();
  });
});
