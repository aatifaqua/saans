import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOUSEHOLD, PLACE, PLAN, stubFetch } from '../../test/fixtures.ts';
import AskBox from './AskBox.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AskBox', () => {
  it('keeps the Ask button disabled until there is a question, and reports failures', async () => {
    render(AskBox, { household: HOUSEHOLD, place: PLACE, plan: PLAN });
    const button = screen.getByRole('button', { name: 'Ask' });
    expect(button).toBeDisabled();
    stubFetch({ error: 'Too many requests. Please wait a minute.' }, 429);
    await fireEvent.input(screen.getByLabelText('Ask about today'), { target: { value: 'Run?' } });
    expect(button).toBeEnabled();
    await fireEvent.submit(screen.getByRole('form', { name: 'Follow-up question' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  });
});
