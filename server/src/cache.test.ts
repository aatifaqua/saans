import { describe, expect, it } from 'vitest';
import { createCache } from './cache.ts';

function clock(): { now: () => number; advance: (ms: number) => void } {
  let time = 0;
  return {
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
  };
}

describe('createCache', () => {
  it('serves a value until it expires, then loads it again', async () => {
    const { now, advance } = clock();
    const cache = createCache<number>({ ttlMs: 1000, maxEntries: 10, now });
    let loads = 0;
    const load = (): Promise<number> => Promise.resolve((loads += 1));
    expect(await cache.get('k', load)).toBe(1);
    advance(999);
    expect(await cache.get('k', load)).toBe(1);
    advance(1);
    expect(await cache.get('k', load)).toBe(2);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const cache = createCache<string>({ ttlMs: 1000, maxEntries: 10, now: () => 0 });
    let loads = 0;
    const load = async (): Promise<string> => {
      loads += 1;
      await Promise.resolve();
      return 'v';
    };
    expect(await Promise.all([cache.get('k', load), cache.get('k', load)])).toEqual(['v', 'v']);
    expect(loads).toBe(1);
  });

  it('does not keep a failed load', async () => {
    const cache = createCache<string>({ ttlMs: 1000, maxEntries: 10, now: () => 0 });
    await expect(cache.get('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.get('k', () => Promise.resolve('up'))).toBe('up');
  });

  it('evicts expired entries first, then the oldest, when full', async () => {
    const { now, advance } = clock();
    const cache = createCache<string>({ ttlMs: 100, maxEntries: 2, now });
    await cache.get('old', () => Promise.resolve('1'));
    advance(150);
    await cache.get('a', () => Promise.resolve('2'));
    await cache.get('b', () => Promise.resolve('3'));
    await cache.get('c', () => Promise.resolve('4'));
    expect(await cache.get('c', () => Promise.resolve('kept'))).toBe('4');
    expect(await cache.get('a', () => Promise.resolve('reloaded'))).toBe('reloaded');
  });
});
