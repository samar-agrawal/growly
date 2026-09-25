import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.next/**',
      '**/data/**',
      'frontend/src/**',
      'frontend/vite.config.js',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
    },
  },
  { files: ['backend/**/*.js'], languageOptions: { sourceType: 'commonjs' } },
];
