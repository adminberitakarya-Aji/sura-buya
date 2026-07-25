/**
 * @suro-buya/templates - Universe Templates
 * 
 * Main entry point for the templates package.
 * Provides template definitions, schemas, and validation for universe creation.
 */

export * from './schemas';
export * from './creator';
export * from './engine';
export * from './prompt';
export * from './api';

/**
 * Package version
 */
export const VERSION = '0.1.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: '@suro-buya/templates',
  version: VERSION,
  description: 'Template definitions for Suro-Buya universe creation',
} as const;