import { defineConfig, mergeConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import viteConfig from './vite.config.ts';

/** Component tests run in jsdom with axe matchers; main.ts only mounts the app. */
export default defineConfig(
  mergeConfig(viteConfig, {
    plugins: [svelteTesting()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.ts'],
      testTimeout: 20_000,
      // The contrast test reads the real stylesheet, so CSS is processed in tests too.
      css: { include: [/app\.css/] },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,svelte}'],
        exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/**/*.d.ts'],
        // Branch counts include the update paths Svelte compiles into every {#each} block.
        thresholds: { lines: 95, functions: 95, branches: 85, statements: 95 },
      },
    },
  }),
);
