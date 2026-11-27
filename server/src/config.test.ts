import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('uses safe defaults for local development', () => {
    expect(loadConfig({})).toEqual({
      geminiApiKey: undefined,
      models: [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.6-flash',
      ],
      port: 8080,
      staticDir: undefined,
      trustProxy: false,
      rateLimit: { perMinute: 60, aiPerMinute: 10 },
    });
  });

  it('reads the key, model chain, port, static folder and proxy setting', () => {
    const config = loadConfig({
      GEMINI_API_KEY: ' k ',
      GEMINI_MODELS: 'm1, m2 ,',
      PORT: '9000',
      STATIC_DIR: 'web/dist',
      TRUST_PROXY: '1',
    });
    expect(config).toMatchObject({
      geminiApiKey: 'k',
      models: ['m1', 'm2'],
      port: 9000,
      staticDir: 'web/dist',
      trustProxy: true,
    });
  });

  it('refuses to start in production without a Gemini key, so live AI is never silently off', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/GEMINI_API_KEY/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });
});
