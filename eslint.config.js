// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

/** Complexity budgets keep every module small enough to read in one sitting. */
const budgets = {
  complexity: ['error', 10],
  'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
};

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  // No rule can be switched off from inside a file; exceptions live here, in the open.
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  svelte.configs['flat/recommended'],
  svelte.configs['flat/prettier'],
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js', '*.ts', 'web/*.js'] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...budgets,
      // One import statement per module, values and types together.
      'no-duplicate-imports': 'error',
      // Generated text must only ever reach the page as escaped text nodes.
      'svelte/no-at-html-tags': 'error',
      // Logging goes through the one error handler and the start-up line, never ad hoc.
      'no-console': 'error',
      // Data is narrowed by guards and schemas, never asserted into a type (`as const` is allowed).
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      // Work is finished or tracked elsewhere, not parked in a comment.
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx'] }],
      eqeqeq: 'error',
    },
  },
  {
    files: ['eslint.config.js', 'web/size-budget.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['server/src/index.ts', 'server/src/errors.ts', 'web/size-budget.js'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['**/*.test.ts', '**/vitest.setup.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
