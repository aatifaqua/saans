import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { HOUSEHOLD, PLACE, PLAN, stubFetch } from '../../test/fixtures.ts';
import PlanPanel from './PlanPanel.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlanPanel', () => {
  it('shows the Gemini plan with hack titles, then answers a follow-up', async () => {
    stubFetch({ plan: PLAN, model: 'gemini-3.6-flash', disclaimer: 'd' });
    const { container } = render(PlanPanel, { household: HOUSEHOLD, place: PLACE });
    await fireEvent.click(screen.getByRole('button', { name: "Make today's plan" }));
    expect(await screen.findByText('Quick school drop by car')).toBeInTheDocument();
    expect(screen.getByText(/Close windows during the worst hours/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-3.6-flash/)).toBeInTheDocument();
    const ready = screen.getByText("Today's plan is ready.");
    // The announcement sits outside the busy region, so screen readers do not hold it back.
    expect(ready.closest('[aria-busy]')).toBeNull();
    expect(container.querySelector('[aria-busy="false"]')).not.toBeNull();
    // Focus moves to the new plan rather than the whole plan being read out as a live region.
    expect(document.activeElement).toHaveTextContent(PLAN.summary);
    expect(container.querySelector('.summary')?.closest('[aria-live]')).toBeNull();
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

    stubFetch({ answer: 'Yes, between 2 and 5 PM with a mask.', model: 'm', disclaimer: 'd' });
    await fireEvent.input(screen.getByLabelText('Ask about today'), {
      target: { value: 'Can we go to the park?' },
    });
    await fireEvent.submit(screen.getByRole('form', { name: 'Follow-up question' }));
    const shown = await screen.findByText('Yes, between 2 and 5 PM with a mask.');
    expect(shown.closest('[aria-live]')).toHaveTextContent('not medical advice');
    expect(await axe(container)).toHaveNoViolations();

    stubFetch({ plan: PLAN, model: 'gemini-3.6-flash', disclaimer: 'd' });
    await fireEvent.click(screen.getByRole('button', { name: 'Make a fresh plan' }));
    await waitFor(() => {
      expect(screen.queryByText('Yes, between 2 and 5 PM with a mask.')).not.toBeInTheDocument();
    });
  });

  it('offers a retry and shows no plan when the AI is unavailable', async () => {
    stubFetch({ error: 'The AI assistant is unavailable right now. Please retry.' }, 503);
    const { container } = render(PlanPanel, { household: HOUSEHOLD, place: PLACE });
    await fireEvent.click(screen.getByRole('button', { name: "Make today's plan" }));
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.queryByText('Quick school drop by car')).not.toBeInTheDocument();
    stubFetch({ plan: PLAN, model: 'm', disclaimer: 'd' });
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByText('Quick school drop by car')).toBeInTheDocument();
    });
  });
});
