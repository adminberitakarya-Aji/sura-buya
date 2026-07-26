import { describe, it, expect } from 'vitest';
import {
  slugify,
  validateUniverseId,
  validateManifest,
  generateManifest,
  manifestToConfig,
  type WizardAnswers,
} from '../src/utils/manifest.js';

describe('Manifest Utilities', () => {
  describe('slugify', () => {
    it('should convert strings to valid URL-friendly slugs', () => {
      expect(slugify('Suro & Buya')).toBe('suro-buya');
      expect(slugify('  My Awesome Universe!! ')).toBe('my-awesome-universe');
      expect(slugify('Hello World 123')).toBe('hello-world-123');
    });
  });

  describe('validateUniverseId', () => {
    it('should validate valid universe IDs', () => {
      expect(validateUniverseId('suro-buya')).toEqual({ valid: true });
      expect(validateUniverseId('universe123')).toEqual({ valid: true });
    });

    it('should reject invalid universe IDs', () => {
      expect(validateUniverseId('')).toEqual({
        valid: false,
        error: 'Universe ID is required',
      });
      expect(validateUniverseId('Suro_Buya!')).toEqual({
        valid: false,
        error: 'Universe ID must be lowercase alphanumeric with hyphens only',
      });
      expect(validateUniverseId('-suro-buya')).toEqual({
        valid: false,
        error: 'Universe ID cannot start or end with hyphen',
      });
      expect(validateUniverseId('suro--buya')).toEqual({
        valid: false,
        error: 'Universe ID cannot contain consecutive hyphens',
      });
    });
  });

  describe('generateManifest & validateManifest', () => {
    it('should generate a valid manifest from wizard answers', () => {
      const answers: WizardAnswers = {
        universeName: 'Suro & Buya Adventure',
        description: 'An adventurous universe set in Surabaya',
        defaultLanguage: 'id',
        targetAudience: 'all-ages',
        tone: 'hopeful',
        aiProvider: 'balanced',
        characters: [
          {
            name: 'Suro',
            role: 'PROTAGONIST',
            description: 'The brave shark explorer',
            coreTraits: ['brave', 'curious'],
            coreWeakness: 'Impulsive',
          },
          {
            name: 'Buya',
            role: 'DEUTERAGONIST',
            description: 'The clever crocodile thinker',
            coreTraits: ['wise', 'cautious'],
            coreWeakness: 'Overthinking',
          },
        ],
        regions: [
          {
            name: 'Kalimas Harbor',
            description: 'A bustling ancient port',
          },
        ],
      };

      const manifest = generateManifest(answers);
      expect(manifest.id).toBe('suro-buya-adventure');
      expect(manifest.name).toBe('Suro & Buya Adventure');
      expect(manifest.characters).toHaveLength(2);
      expect(manifest.regions).toHaveLength(1);

      const validation = validateManifest(manifest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation on invalid manifest structure', () => {
      const invalidManifest = {
        id: 'Invalid ID!',
        name: 123,
      };

      const validation = validateManifest(invalidManifest);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('manifestToConfig', () => {
    it('should convert manifest to UniverseConfig format', () => {
      const answers: WizardAnswers = {
        universeName: 'Test Universe',
        targetAudience: 'all-ages',
        tone: 'hopeful',
        characters: [{ name: 'Hero' }],
        regions: [{ name: 'City' }],
      };

      const manifest = generateManifest(answers);
      const config = manifestToConfig(manifest);

      expect(config.id).toBe(manifest.id);
      expect(config.name).toBe(manifest.name);
      expect(config.locale).toBe(manifest.defaultLanguage);
      expect(config.timezone).toBe('Asia/Jakarta');
    });
  });
});
