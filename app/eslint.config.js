import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  // The React Hooks ruleset (v7) carries the React Compiler's lint rules, so a
  // component the compiler cannot safely optimise fails `npm run lint`
  // (DIRECTION §3.7).
  reactHooks.configs.flat['recommended-latest'],
  // Accessibility is the default from the first component (standing rule;
  // DIRECTION §3.7): jsx-a11y flags inaccessible markup at lint time, before
  // the behavior level's axe check.
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { react },
    rules: {
      // ESLint core's no-unused-vars does not see JSX element references, so a
      // component used only in JSX reads as unused. jsx-uses-vars marks it
      // used (React 19's automatic runtime needs no React import, so
      // jsx-uses-react stays off).
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Test files and build config run in Node and reach Vitest's APIs through
    // imports; they still reference browser globals (document, window) under
    // jsdom.
    files: ['**/*.{test,spec}.{js,jsx}', 'src/test/**', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
