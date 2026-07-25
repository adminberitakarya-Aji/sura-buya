/**
 * @suro-buya/templates - ESLint Configuration
 * 
 * Local ESLint configuration extending the root config.
 * This ensures proper ignore patterns for this package.
 */

const baseConfig = require('../../../eslint.config.cjs');

module.exports = {
  ...baseConfig,
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
};