import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { DAY, PLACE } from '../../test/fixtures.ts';
import AirNow from './AirNow.svelte';

describe('AirNow', () => {
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
});
