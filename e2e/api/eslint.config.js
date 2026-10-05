import js from '@eslint/js';
import globals from 'globals';

// Flat config matching app/eslint.config.js, with the React plugins stripped:
// this is a Node harness (black-box HTTP and git), not a React tree.
export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
