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

  it('reports a query that is too short on the field, focuses it, and sends nothing', async () => {
    const fetched = vi.fn();
    vi.stubGlobal('fetch', fetched);
    const { container } = render(PlaceSearch, { place: null, onselect: vi.fn() });
    const field = screen.getByLabelText('City or town');
    expect(field).toHaveAccessibleDescription(/^A city or town in India, for example Lucknow. *$/);
    expect(field).not.toHaveAttribute('placeholder');
    await fireEvent.input(field, { target: { value: ' L ' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(fetched).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Type at least 2 letters of the name\.$/);
    expect(document.activeElement).toBe(field);
    expect(await axe(container)).toHaveNoViolations();
    stubFetch({ places: [] });
    await fireEvent.input(field, { target: { value: 'Lu' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('No Indian city or town found.')).toBeInTheDocument();
    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('keeps the Search button focusable while busy and ignores a second press', async () => {
    const release: ((res: Response) => void)[] = [];
    const fetched = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release.push(resolve);
        }),
    );
    vi.stubGlobal('fetch', fetched);
    render(PlaceSearch, { place: null, onselect: vi.fn() });
    const button = screen.getByRole('button', { name: 'Search' });
    await fireEvent.input(screen.getByLabelText('City or town'), { target: { value: 'Agra' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    // Sighted users see the button say what it is doing; it is not dimmed.
    expect(button).toHaveTextContent('Searching');
    await fireEvent.submit(screen.getByRole('search'));
    expect(fetched).toHaveBeenCalledTimes(1);
    release[0]?.(
      Response.json({
        places: [
          { name: 'Agra', region: 'Uttar Pradesh', lat: 27.18, lon: 78.01 },
          { name: 'Agra', region: 'Madhya Pradesh', lat: 23.9, lon: 77.6 },
        ],
      }),
    );
    expect(await screen.findByText('2 places found.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Matching places' }).children).toHaveLength(2);
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveTextContent(/^Search$/);
  });

  it('clears the field error while typing, and old matches when a short query is rejected', async () => {
    stubFetch({ places: [{ name: 'Lucknow', region: 'Uttar Pradesh', lat: 26.85, lon: 80.95 }] });
    render(PlaceSearch, { place: null, onselect: vi.fn() });
    const field = screen.getByLabelText('City or town');
    await fireEvent.input(field, { target: { value: 'Luck' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('1 place found.')).toBeInTheDocument();
    await fireEvent.input(field, { target: { value: 'L' } });
    await fireEvent.submit(screen.getByRole('search'));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('1 place found.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Matching places' })).not.toBeInTheDocument();
    await fireEvent.input(field, { target: { value: 'L ' } });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await fireEvent.input(field, { target: { value: 'Lu' } });
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/Type at least 2 letters/)).not.toBeInTheDocument();
  });
});
