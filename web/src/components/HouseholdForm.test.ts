import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { HOUSEHOLD } from '../../test/fixtures.ts';
import HouseholdForm from './HouseholdForm.svelte';

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
