// eslint.config.js — Configuración de ESLint separada para backend y frontend
'use strict';

const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,

  // BACKEND: Node.js
  {
    files: ['server.js', 'config.js', 'routes/**/*.js', 'middleware/**/*.js', 'db/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly', process: 'readonly', require: 'readonly',
        module: 'readonly', exports: 'readonly', __dirname: 'readonly',
        __filename: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        Buffer: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef':       'error',
      'no-console':     'off',
      'eqeqeq':         ['error', 'always'],
      'no-var':         'error',
      'prefer-const':   'error',
      'no-duplicate-imports': 'error',
      'no-return-await': 'error',
    },
  },

  // FRONTEND: Navegador
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        location: 'readonly', fetch: 'readonly', requestAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly', FormData: 'readonly', FileReader: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef':       'error',
      'no-console':     ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq':         ['error', 'always'],
      'no-var':         'error',
    },
  },
];
