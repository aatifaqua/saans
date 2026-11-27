import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { HOUSEHOLD, PLACE, PLAN, stubFetch } from '../../test/fixtures.ts';
import AskBox from './AskBox.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AskBox', () => {
  it('reports an empty question on the field, focuses it, and sends nothing', async () => {
    const fetched = vi.fn();
    vi.stubGlobal('fetch', fetched);
    const { container } = render(AskBox, { household: HOUSEHOLD, place: PLACE, plan: PLAN });
    const field = screen.getByLabelText('Ask about today');
    expect(field).toHaveAccessibleDescription(/^For example: Can the children play outside/);
    expect(field).not.toHaveAttribute('placeholder');
    await fireEvent.submit(screen.getByRole('form', { name: 'Follow-up question' }));
    expect(fetched).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Type a question before asking\.$/);
    expect(document.activeElement).toBe(field);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('clears the field error once a question is sent, and reports failures as an alert', async () => {
    render(AskBox, { household: HOUSEHOLD, place: PLACE, plan: PLAN });
    const form = screen.getByRole('form', { name: 'Follow-up question' });
    await fireEvent.submit(form);
    stubFetch({ error: 'Too many requests. Please wait a minute.' }, 429);
    await fireEvent.input(screen.getByLabelText('Ask about today'), { target: { value: 'Run?' } });
    await fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(screen.getByLabelText('Ask about today')).not.toHaveAttribute('aria-invalid');
  });

  it('keeps the Ask button focusable while busy and ignores a second press', async () => {
    const release: ((res: Response) => void)[] = [];
    const fetched = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release.push(resolve);
        }),
    );
    vi.stubGlobal('fetch', fetched);
    render(AskBox, { household: HOUSEHOLD, place: PLACE, plan: PLAN });
    const form = screen.getByRole('form', { name: 'Follow-up question' });
    const button = screen.getByRole('button', { name: 'Ask' });
    await fireEvent.input(screen.getByLabelText('Ask about today'), { target: { value: 'Run?' } });
    await fireEvent.submit(form);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    // Sighted users see the button say what it is doing; it is not dimmed.
    expect(button).toHaveTextContent('Asking');
    expect(screen.getByRole('status')).toHaveTextContent('Asking Gemini.');
    await fireEvent.submit(form);
    expect(fetched).toHaveBeenCalledTimes(1);
    release[0]?.(Response.json({ answer: 'Only after 2 pm.', model: 'm', disclaimer: 'd' }));
    expect(await screen.findByText('Only after 2 pm.')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveTextContent(/^Ask$/);
  });

  it('clears the field error while typing, and an old failure when a blank is rejected', async () => {
    render(AskBox, { household: HOUSEHOLD, place: PLACE, plan: PLAN });
    const form = screen.getByRole('form', { name: 'Follow-up question' });
    const field = screen.getByLabelText('Ask about today');
    await fireEvent.submit(form);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await fireEvent.input(field, { target: { value: '  ' } });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await fireEvent.input(field, { target: { value: 'Run?' } });
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Type a question before asking.')).not.toBeInTheDocument();
    stubFetch({ error: 'Too many requests. Please wait a minute.' }, 429);
    await fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await fireEvent.input(field, { target: { value: '' } });
    await fireEvent.submit(form);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });
});
