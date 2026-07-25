import { describe, it, expect } from 'vitest';
import { SCHEMAS } from '../src/types/index.js';

describe('Shared Types', () => {
  describe('SCHEMAS.baseEntity', () => {
    it('should validate a valid base entity', () => {
      const validEntity = {
        id: 'test-123',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
      };
      
      expect(() => SCHEMAS.baseEntity.parse(validEntity)).not.toThrow();
    });

    it('should reject invalid id', () => {
      const invalidEntity = {
        id: '',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
      };
      
      expect(() => SCHEMAS.baseEntity.parse(invalidEntity)).toThrow();
    });

    it('should reject invalid version', () => {
      const invalidEntity = {
        id: 'test-123',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: -1,
      };
      
      expect(() => SCHEMAS.baseEntity.parse(invalidEntity)).toThrow();
    });
  });

  describe('SCHEMAS.universeConfig', () => {
    it('should validate a valid universe config', () => {
      const validConfig = {
        id: 'suro-buya',
        name: 'Suro Buya Universe',
        version: '1.0.0',
        locale: 'id-ID',
        locales: ['id-ID', 'en-US'],
        timezone: 'Asia/Jakarta',
      };
      
      expect(() => SCHEMAS.universeConfig.parse(validConfig)).not.toThrow();
    });

    it('should reject invalid id format', () => {
      const invalidConfig = {
        id: 'Suro Buya', // spaces and uppercase not allowed
        name: 'Suro Buya Universe',
        version: '1.0.0',
        locale: 'id-ID',
        locales: ['id-ID'],
        timezone: 'Asia/Jakarta',
      };
      
      expect(() => SCHEMAS.universeConfig.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid version format', () => {
      const invalidConfig = {
        id: 'suro-buya',
        name: 'Suro Buya Universe',
        version: '1.0', // missing patch version
        locale: 'id-ID',
        locales: ['id-ID'],
        timezone: 'Asia/Jakarta',
      };
      
      expect(() => SCHEMAS.universeConfig.parse(invalidConfig)).toThrow();
    });
  });

  describe('SCHEMAS.characterProfile', () => {
    it('should validate a valid character profile', () => {
      const validCharacter = {
        id: 'char-suro',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
        name: 'Suro',
        archetype: 'protagonist',
        description: 'A curious young inventor',
        traits: ['Curious', 'Inventive', 'Compassionate'],
        voice: {
          tone: 'Optimistic',
          vocabulary: ['gadget', 'mechanism'],
          speechPatterns: ['Asks questions'],
        },
      };
      
      expect(() => SCHEMAS.characterProfile.parse(validCharacter)).not.toThrow();
    });

    it('should reject invalid archetype', () => {
      const invalidCharacter = {
        id: 'char-suro',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
        name: 'Suro',
        archetype: 'invalid-archetype',
        description: 'A curious young inventor',
        traits: ['Curious'],
      };
      
      expect(() => SCHEMAS.characterProfile.parse(invalidCharacter)).toThrow();
    });

    it('should reject empty traits array', () => {
      const invalidCharacter = {
        id: 'char-suro',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
        name: 'Suro',
        archetype: 'protagonist',
        description: 'A curious young inventor',
        traits: [], // must have at least 1
      };
      
      expect(() => SCHEMAS.characterProfile.parse(invalidCharacter)).toThrow();
    });
  });

  describe('SCHEMAS.worldProfile', () => {
    it('should validate a valid world profile', () => {
      const validWorld = {
        id: 'world-aetheris',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
        name: 'Aetheris',
        type: 'planet',
        description: 'A world of floating islands',
      };
      
      expect(() => SCHEMAS.worldProfile.parse(validWorld)).not.toThrow();
    });

    it('should reject invalid world type', () => {
      const invalidWorld = {
        id: 'world-aetheris',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        version: 1,
        name: 'Aetheris',
        type: 'invalid-type',
        description: 'A world of floating islands',
      };
      
      expect(() => SCHEMAS.worldProfile.parse(invalidWorld)).toThrow();
    });
  });

  describe('SCHEMAS.generationRequest', () => {
    it('should validate a valid generation request', () => {
      const validRequest = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        universeId: 'suro-buya',
        type: 'scene',
        input: { sceneNumber: 1 },
        context: {
          previousScenes: [],
          characterStates: {},
          worldState: {},
        },
        options: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096,
          stream: false,
        },
      };
      
      expect(() => SCHEMAS.generationRequest.parse(validRequest)).not.toThrow();
    });

    it('should reject invalid requestId', () => {
      const invalidRequest = {
        requestId: 'not-a-uuid',
        universeId: 'suro-buya',
        type: 'scene',
        input: {},
      };
      
      expect(() => SCHEMAS.generationRequest.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid universeId format', () => {
      const invalidRequest = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        universeId: 'Suro Buya', // uppercase and spaces not allowed
        type: 'scene',
        input: {},
      };
      
      expect(() => SCHEMAS.generationRequest.parse(invalidRequest)).toThrow();
    });
  });
});