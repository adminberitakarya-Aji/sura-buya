/**
 * @suro-buya/shared - Constants
 * 
 * Centralized constants for the Suro-Buya universe.
 */

import { z } from 'zod';

/**
 * Universe constants
 */
export const UNIVERSE_CONSTANTS = {
  /** Default universe ID */
  DEFAULT_UNIVERSE_ID: 'suro-buya',
  
  /** Universe version */
  UNIVERSE_VERSION: '1.0.0',
  
  /** Default locale */
  DEFAULT_LOCALE: 'id-ID',
  
  /** Supported locales */
  SUPPORTED_LOCALES: ['id-ID', 'en-US'] as const,
  
  /** Default timezone */
  DEFAULT_TIMEZONE: 'Asia/Jakarta',
} as const;

/**
 * Engine constants
 */
export const ENGINE_CONSTANTS = {
  /** Default engine version */
  ENGINE_VERSION: '2.0.0',
  
  /** Default model */
  DEFAULT_MODEL: 'gpt-4',
  
  /** Max tokens per generation */
  MAX_TOKENS: 4096,
  
  /** Default temperature */
  DEFAULT_TEMPERATURE: 0.7,
  
  /** Request timeout (ms) */
  REQUEST_TIMEOUT: 120000,
  
  /** Max retries */
  MAX_RETRIES: 3,
} as const;

/**
 * File paths
 */
export const PATHS = {
  /** Universe bible directory */
  UNIVERSE_BIBLE: 'universe-bible',
  
  /** Characters directory */
  CHARACTERS: 'characters',
  
  /** Worlds directory */
  WORLDS: 'worlds',
  
  /** Stories directory */
  STORIES: 'stories',
  
  /** Visual assets directory */
  VISUALS: 'visuals',
  
  /** Production assets directory */
  PRODUCTION: 'production',
  
  /** Templates directory */
  TEMPLATES: 'templates',
  
  /** Output directory */
  OUTPUT: 'output',
  
  /** Cache directory */
  CACHE: '.cache',
  
  /** Logs directory */
  LOGS: 'logs',
} as const;

/**
 * File extensions
 */
export const FILE_EXTENSIONS = {
  /** TypeScript files */
  TS: '.ts',
  
  /** JavaScript files */
  JS: '.js',
  
  /** JSON files */
  JSON: '.json',
  
  /** YAML files */
  YAML: '.yaml',
  
  /** YML files */
  YML: '.yml',
  
  /** Markdown files */
  MD: '.md',
  
  /** Text files */
  TXT: '.txt',
  
  /** PNG images */
  PNG: '.png',
  
  /** JPG images */
  JPG: '.jpg',
  
  /** WebP images */
  WEBP: '.webp',
  
  /** SVG images */
  SVG: '.svg',
} as const;

/**
 * Environment variables
 */
export const ENV_VARS = {
  /** OpenAI API key */
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  
  /** Anthropic API key */
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  
  /** Database URL */
  DATABASE_URL: 'DATABASE_URL',
  
  /** Redis URL */
  REDIS_URL: 'REDIS_URL',
  
  /** Log level */
  LOG_LEVEL: 'LOG_LEVEL',
  
  /** Node environment */
  NODE_ENV: 'NODE_ENV',
  
  /** Port */
  PORT: 'PORT',
} as const;

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  /** Log level */
  LOG_LEVEL: 'info',
  
  /** Enable debug mode */
  DEBUG: false,
  
  /** Enable caching */
  CACHE_ENABLED: true,
  
  /** Cache TTL (seconds) */
  CACHE_TTL: 3600,
  
  /** Max concurrent operations */
  MAX_CONCURRENT: 5,
  
  /** Batch size */
  BATCH_SIZE: 10,
} as const;

/**
 * Validation schemas
 */
export const VALIDATION_SCHEMAS = {
  /** Universe ID schema */
  UNIVERSE_ID: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  
  /** Character ID schema */
  CHARACTER_ID: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  
  /** World ID schema */
  WORLD_ID: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  
  /** Story ID schema */
  STORY_ID: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  
  /** Locale schema */
  LOCALE: z.enum(['id-ID', 'en-US']),
  
  /** Version schema */
  VERSION: z.string().regex(/^\d+\.\d+\.\d+$/),
} as const;
