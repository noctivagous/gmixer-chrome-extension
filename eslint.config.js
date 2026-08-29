import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['extension/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
        __GMIXER_DEBUG__: 'readonly',
      },
    },
    rules: {
      // The analyzer deliberately initializes DOM fallbacks before guarded
      // reads; this rule misidentifies several of those defensive paths.
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['build.js', 'scripts/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-regex-spaces': 'off',
    },
  },
  {
    files: ['test/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['test/browser/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
