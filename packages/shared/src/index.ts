/**
 * @suro-buya/shared - Shared utilities, types, and constants
 * 
 * Main entry point for the shared package.
 */

export * from './constants/index.js';
export * from './utils/index.js';
export * from './types/index.js';
export * from './storage/r2-client.js';

/**
 * Package version
 */
export const VERSION = '0.1.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: '@suro-buya/shared',
  version: VERSION,
  description: 'Shared utilities, types, and constants for Suro-Buya',
} as const;