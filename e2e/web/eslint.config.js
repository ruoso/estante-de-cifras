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
  // Specs drive the app through its real UI (lib/journeys.js): no dev mounts, no
  // state injected into the page, no mocked network, no API writes the UI can
  // make. The rare legitimate exception (the PWA test faking a redeploy, the
  // chart gallery that has no product route) carries an eslint-disable comment
  // saying why.
  {
    files: ['tests/**/*.spec.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#dev\\//], TemplateElement[value.raw=/#dev\\//]',
          message: 'No #dev/* mounts in e2e specs: reach the screen through the real UI (lib/journeys.js).',
        },
        {
          selector: "CallExpression[callee.property.name='addInitScript']",
          message: 'No init scripts: do not inject state into the page; use platform emulation (context options) or the UI.',
        },
        {
          selector: "CallExpression[callee.property.name=/^(route|routeFromHAR)$/]",
          message: 'No network mocking in e2e specs: the stack is real.',
        },
        {
          selector: "CallExpression[callee.property.name='dispatchEvent']",
          message: 'No synthetic events: use context.setOffline (journeys.networkBlip) or the UI.',
        },
        {
          selector:
            "CallExpression[callee.object.property.name='request'][callee.property.name=/^(post|put|patch|delete|fetch)$/]",
          message: 'No API writes from specs: make the state through the UI (read-only GETs are fine).',
        },
      ],
    },
  },
];
