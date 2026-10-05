import js from '@eslint/js';
import globals from 'globals';

// Flat config matching e2e/api/eslint.config.js (a Node harness, no React),
// with browser globals added: Playwright's evaluate / waitForFunction callbacks
// reference the page's globals (navigator, document) inline in these files, so
// ESLint parses them as part of the module. node for the harness, browser for
// the in-page callbacks.
export default [
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
