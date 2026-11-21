import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientKey, rateLimit } from './middleware.ts';

async function keyFor(trustProxy: boolean, headers: Record<string, string>): Promise<string> {
  const app = new Hono();
  const keyOf = clientKey(trustProxy, () => '10.0.0.1');
  app.get('/', (c) => c.text(keyOf(c)));
  return (await app.request('/', { headers })).text();
}

describe('clientKey', () => {
  it('uses the socket address unless the proxy is trusted', async () => {
    expect(await keyFor(false, { 'x-forwarded-for': '1.1.1.1' })).toBe('10.0.0.1');
  });

  it('uses the address the trusted proxy appended, ignoring client-supplied ones', async () => {
    expect(await keyFor(true, { 'x-forwarded-for': 'spoofed, 2.2.2.2' })).toBe('2.2.2.2');
  });

  it('falls back to the socket when the trusted header is missing', async () => {
    expect(await keyFor(true, {})).toBe('10.0.0.1');
  });
});

describe('rateLimit', () => {
  it('sweeps expired counters once there are more clients than the cap', async () => {
    let time = 0;
    const app = new Hono();
    app.use(
      rateLimit({
        perMinute: 1,
        now: () => time,
        keyOf: (c) => c.req.header('x-client') ?? '',
        maxClients: 1,
      }),
    );
    app.get('/', (c) => c.text('ok'));
    const hit = async (client: string): Promise<number> =>
      (await app.request('/', { headers: { 'x-client': client } })).status;
    expect(await hit('a')).toBe(200);
    expect(await hit('b')).toBe(200);
    expect(await hit('a')).toBe(429);
    time = 61_000;
    expect(await hit('c')).toBe(200);
    expect(await hit('a')).toBe(200);
  });
});
