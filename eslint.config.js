// @ts-check
const { createRequire } = require('node:module');
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const requireFromWeb = createRequire(require.resolve('./web/package.json'));
const angular = requireFromWeb('angular-eslint');

/** @type {import('eslint').Linter.RulesRecord} */
const maintainabilityRules = {
  complexity: ['error', 10],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
  'max-params': ['error', 4],
  'max-depth': ['error', 3],
  'max-nested-callbacks': ['error', 3],
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
  'no-nested-ternary': 'error',
  'no-else-return': 'error',
};

module.exports = defineConfig([
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/lib/**', '**/.angular/**'],
  },
  {
    files: ['web/src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      ...maintainabilityRules,
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['web/src/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/cyclomatic-complexity': ['error', { maxComplexity: 12 }],
      '@angular-eslint/template/conditional-complexity': ['error', { maxComplexity: 5 }],
    },
  },
  {
    files: ['backend/src/**/*.ts', 'shared/src/**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
    rules: {
      ...maintainabilityRules,
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
