import { render, screen } from '@testing-library/svelte';
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
});
