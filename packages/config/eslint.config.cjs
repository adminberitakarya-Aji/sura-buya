/**
 * @suro-buya/config - ESLint Configuration
 * 
 * Shared ESLint configuration for all Suro-Buya packages.
 * Uses ESLint 8 compatible config format.
 */

module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsdoc/recommended',
    'plugin:unicorn/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['../../tsconfig.json', '../*/tsconfig.json', '../../apps/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'jsdoc',
    'unicorn',
  ],
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    'dist/cjs/**',
    'build/**',
    '.cache/**',
    'coverage/**',
    '*.config.js',
    '*.config.ts',
    'eslint.config.cjs',
    'prettier.config.cjs',
    'tsconfig*.json',
    '.eslintrc*',
    '.prettierrc*',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'warn',
    
    // Import rules
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@suro-buya/**', group: 'internal' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always',
      },
    ],
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    
    // JSDoc rules
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/valid-types': 'warn',
    'jsdoc/check-types': 'warn',
    
    // Unicorn rules
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/filename-case': [
      'error',
      {
        cases: {
          kebabCase: true,
          pascalCase: true,
        },
      },
    ],
    'unicorn/no-null': 'off',
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/prefer-module': 'error',
  },
  overrides: [
    // Test files
    {
      files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js', '**/__tests__/**', '**/__mocks__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'unicorn/prevent-abbreviations': 'off',
      },
    },
    // Config files
    {
      files: ['*.config.*', '*.setup.*', '*.rc.*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
