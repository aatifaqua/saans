/** Repository-wide conventions, checked by reading the files rather than trusted to habit. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const SOURCE_FOLDERS = ['packages/core', 'server', 'web'].flatMap((unit) => [
  join(ROOT, unit, 'src'),
  join(ROOT, unit, 'test'),
]);
const EM_DASH = String.fromCodePoint(0x2014);
// Assembled from parts, so this file does not contain the markers it looks for.
const SUPPRESSION = new RegExp(
  [
    'eslint-' + 'disable',
    '@ts-' + 'ignore',
    '@ts-' + 'expect-error',
    'TO' + 'DO',
    'FIX' + 'ME',
  ].join('|'),
  'i',
);

/** Every file under `folder`, as paths relative to the repository root. */
function filesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
}

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const sources = SOURCE_FOLDERS.flatMap(filesIn).filter((path) => /\.(ts|svelte)$/.test(path));
const modules = sources.filter((path) => !path.endsWith('.test.ts'));

describe('conventions', () => {
  it('finds the three workspaces', () => {
    expect(modules.length).toBeGreaterThan(30);
    expect(modules).toContain('packages/core/src/aqi.ts');
    expect(modules).toContain('web/src/App.svelte');
  });

  it('opens every module with a comment that says what its one job is', () => {
    const missing = modules.filter((path) => !/^(\/\*\*|<!--)/.test(read(path)));
    expect(missing).toEqual([]);
  });

  it('keeps one test file beside every module that has logic', () => {
    const untested = modules
      .filter((path) => path.includes('/src/') && !/\/(index|main|types)\.ts$/.test(path))
      .filter((path) => !sources.includes(path.replace(/\.(ts|svelte)$/, '.test.ts')))
      .sort();
    // These are exercised through the app-level tests of the module that mounts them.
    expect(untested).toEqual([
      'server/src/middleware/sameSite.ts',
      'server/src/middleware/security.ts',
      'server/src/openMeteo.ts',
      'server/src/request.ts',
      'server/src/routes/ai.ts',
      'server/src/routes/air.ts',
      'server/src/static.ts',
      'web/src/lib/guards.ts',
    ]);
  });

  it('never silences the linter or leaves a note to fix something later', () => {
    const marked = sources.filter((path) => SUPPRESSION.test(read(path)));
    expect(marked).toEqual([]);
  });

  it('uses no em dash in code, markup or documentation', () => {
    const documents = [
      ...readdirSync(ROOT),
      ...readdirSync(join(ROOT, 'docs')).map((name) => `docs/${name}`),
    ].filter((path) => path.endsWith('.md'));
    expect(documents).toContain('README.md');
    expect([...sources, ...documents].filter((path) => read(path).includes(EM_DASH))).toEqual([]);
  });
});
