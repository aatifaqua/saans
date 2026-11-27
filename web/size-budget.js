// Fails the build when the app's gzipped JavaScript grows past the budget, so the first screen
// stays fast on a slow mobile connection.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 30;
const assets = join(import.meta.dirname, 'dist', 'assets');
const bytes = readdirSync(assets)
  .filter((file) => file.endsWith('.js'))
  .reduce((sum, file) => sum + gzipSync(readFileSync(join(assets, file))).length, 0);
const kb = bytes / 1024;
console.log(`JavaScript: ${kb.toFixed(1)} kB gzipped (budget ${String(BUDGET_KB)} kB)`);
if (kb > BUDGET_KB) process.exit(1);
