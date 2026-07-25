/**
 * @suro-buya/config - Prettier Configuration
 * 
 * Shared Prettier configuration for all Suro-Buya packages.
 */

module.exports = {
  // Print width
  printWidth: 100,
  
  // Tab width
  tabWidth: 2,
  
  // Use tabs instead of spaces
  useTabs: false,
  
  // Semicolons
  semi: true,
  
  // Single quotes
  singleQuote: true,
  
  // Quote props
  quoteProps: 'as-needed',
  
  // JSX single quotes
  jsxSingleQuote: true,
  
  // Trailing commas
  trailingComma: 'es5',
  
  // Bracket spacing
  bracketSpacing: true,
  
  // Bracket same line
  bracketSameLine: false,
  
  // Arrow function parentheses
  arrowParens: 'always',
  
  // Range
  rangeStart: 0,
  rangeEnd: Infinity,
  
  // Require pragma
  requirePragma: false,
  
  // Insert pragma
  insertPragma: false,
  
  // Prose wrap
  proseWrap: 'preserve',
  
  // HTML whitespace sensitivity
  htmlWhitespaceSensitivity: 'css',
  
  // Vue indent script and style
  vueIndentScriptAndStyle: false,
  
  // End of line
  endOfLine: 'lf',
  
  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',
  
  // Single attribute per line
  singleAttributePerLine: false,
  
  // Parser
  parser: 'typescript',
  
  // Plugins
  plugins: [],
  
  // Overrides
  overrides: [
    {
      files: ['*.json', '*.jsonc'],
      options: {
        printWidth: 120,
        tabWidth: 2,
      },
    },
    {
      files: ['*.md', '*.mdx'],
      options: {
        printWidth: 120,
        proseWrap: 'always',
      },
    },
    {
      files: ['*.yaml', '*.yml'],
      options: {
        printWidth: 120,
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: ['*.html', '*.vue', '*.svelte'],
      options: {
        parser: 'html',
        printWidth: 120,
        tabWidth: 2,
        singleQuote: false,
        bracketSameLine: true,
      },
    },
    {
      files: ['*.css', '*.scss', '*.less'],
      options: {
        parser: 'css',
        printWidth: 120,
        tabWidth: 2,
      },
    },
    {
      files: ['*.graphql', '*.gql'],
      options: {
        parser: 'graphql',
        printWidth: 120,
      },
    },
  ],
};
