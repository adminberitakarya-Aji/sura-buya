import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  CREATOR_TEMPLATE_REGISTRY, 
  ENGINE_TEMPLATE_REGISTRY, 
  PROMPT_TEMPLATE_REGISTRY,
  API_TEMPLATE_REGISTRY 
} from '../src/index.js';
import { Schemas } from '../src/schemas/index.js';

describe('Templates Package', () => {
  describe('Schema Validation', () => {
    it('should have baseTemplate schema', () => {
      expect(Schemas.baseTemplate).toBeDefined();
      expect(typeof Schemas.baseTemplate.parse).toBe('function');
    });

    it('should have prompt schema', () => {
      expect(Schemas.prompt).toBeDefined();
      expect(typeof Schemas.prompt.parse).toBe('function');
    });
  });

  describe('CREATOR_TEMPLATE_REGISTRY', () => {
    it('should have character-base template', () => {
      const template = CREATOR_TEMPLATE_REGISTRY['character-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('character-base');
      expect(template.category).toBe('character');
      expect(template.variables).toBeInstanceOf(Array);
      expect(template.variables.length).toBeGreaterThan(0);
    });

    it('should have world-base template', () => {
      const template = CREATOR_TEMPLATE_REGISTRY['world-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('world-base');
      expect(template.category).toBe('world');
    });

    it('should have story-base template', () => {
      const template = CREATOR_TEMPLATE_REGISTRY['story-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('story-base');
      expect(template.category).toBe('story');
    });

    it('should have episode-base template', () => {
      const template = CREATOR_TEMPLATE_REGISTRY['episode-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('episode-base');
      expect(template.category).toBe('episode');
    });

    it('should have scene-base template', () => {
      const template = CREATOR_TEMPLATE_REGISTRY['scene-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('scene-base');
      expect(template.category).toBe('scene');
    });

    it('should validate all creator templates against schema', () => {
      for (const [id, template] of Object.entries(CREATOR_TEMPLATE_REGISTRY)) {
        expect(() => Schemas.baseTemplate.parse(template)).not.toThrow();
      }
    });
  });

  describe('ENGINE_TEMPLATE_REGISTRY', () => {
    it('should have context-base template', () => {
      const template = ENGINE_TEMPLATE_REGISTRY['context-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('context-base');
      expect(template.category).toBe('schema');
    });

    it('should have planning-base template', () => {
      const template = ENGINE_TEMPLATE_REGISTRY['planning-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('planning-base');
      expect(template.category).toBe('schema');
    });

    it('should have execution-base template', () => {
      const template = ENGINE_TEMPLATE_REGISTRY['execution-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('execution-base');
      expect(template.category).toBe('schema');
    });

    it('should have production-base template', () => {
      const template = ENGINE_TEMPLATE_REGISTRY['production-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('production-base');
      expect(template.category).toBe('schema');
    });

    it('should have review-base template', () => {
      const template = ENGINE_TEMPLATE_REGISTRY['review-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('review-base');
      expect(template.category).toBe('schema');
    });

    it('should have validation-base template', () => {
      const template = ENGINE_TEMPLATE_REGISTRY['validation-base']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('validation-base');
      expect(template.category).toBe('schema');
    });

    it('should validate all engine templates against schema', () => {
      for (const [id, template] of Object.entries(ENGINE_TEMPLATE_REGISTRY)) {
        expect(() => Schemas.baseTemplate.parse(template)).not.toThrow();
      }
    });
  });

  describe('PROMPT_TEMPLATE_REGISTRY', () => {
    it('should have generation-scene-v1 template', () => {
      const template = PROMPT_TEMPLATE_REGISTRY['generation-scene-v1']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('generation-scene-v1');
      expect(template.category).toBe('generation');
    });

    it('should have planning-episode-v1 template', () => {
      const template = PROMPT_TEMPLATE_REGISTRY['planning-episode-v1']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('planning-episode-v1');
      expect(template.category).toBe('planning');
    });

    it('should have production-breakdown-v1 template', () => {
      const template = PROMPT_TEMPLATE_REGISTRY['production-breakdown-v1']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('production-breakdown-v1');
      expect(template.category).toBe('production');
    });

    it('should have review-content-v1 template', () => {
      const template = PROMPT_TEMPLATE_REGISTRY['review-content-v1']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('review-content-v1');
      expect(template.category).toBe('review');
    });

    it('should have validation-canon-v1 template', () => {
      const template = PROMPT_TEMPLATE_REGISTRY['validation-canon-v1']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('validation-canon-v1');
      expect(template.category).toBe('validation');
    });

    it('should have generation-dialogue-v1 template', () => {
      const template = PROMPT_TEMPLATE_REGISTRY['generation-dialogue-v1']!;
      expect(template).toBeDefined();
      expect(template.id).toBe('generation-dialogue-v1');
      expect(template.category).toBe('generation');
    });

    it('should validate all prompt templates against prompt schema', () => {
      for (const [id, template] of Object.entries(PROMPT_TEMPLATE_REGISTRY)) {
        expect(() => Schemas.prompt.parse(template)).not.toThrow();
      }
    });
  });

  describe('API_TEMPLATE_REGISTRY', () => {
    it('should have api request templates', () => {
      const requestKeys = [
        'api-generate-scene',
        'api-generate-episode',
        'api-validate-canon',
        'api-get-context',
        'api-list-templates',
      ];
      for (const key of requestKeys) {
        expect(API_TEMPLATE_REGISTRY[key]).toBeDefined();
      }
    });

    it('should have api response templates', () => {
      const responseKeys = [
        'api-generate-scene-success',
        'api-generate-scene-error',
        'api-validate-canon-success',
        'api-get-context-success',
      ];
      for (const key of responseKeys) {
        expect(API_TEMPLATE_REGISTRY[key]).toBeDefined();
      }
    });

    it('should have webhook templates', () => {
      const webhookKeys = [
        'webhook-generation-complete',
        'webhook-validation-failed',
      ];
      for (const key of webhookKeys) {
        expect(API_TEMPLATE_REGISTRY[key]).toBeDefined();
      }
    });

    it('should have sdk templates', () => {
      const sdkKeys = [
        'sdk-typescript-client',
        'sdk-python-client',
      ];
      for (const key of sdkKeys) {
        expect(API_TEMPLATE_REGISTRY[key]).toBeDefined();
      }
    });

    it('should validate all api templates against schema', () => {
      for (const [id, template] of Object.entries(API_TEMPLATE_REGISTRY)) {
        expect(() => Schemas.baseTemplate.parse(template)).not.toThrow();
      }
    });
  });

  describe('Template Structure', () => {
    it('should have content in all templates', () => {
      const allRegistries = [
        CREATOR_TEMPLATE_REGISTRY,
        ENGINE_TEMPLATE_REGISTRY,
        PROMPT_TEMPLATE_REGISTRY,
        API_TEMPLATE_REGISTRY,
      ];

      for (const registry of allRegistries) {
        for (const [id, template] of Object.entries(registry)) {
          expect(template.content).toBeDefined();
          expect(typeof template.content).toBe('string');
          expect(template.content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have variables array in all templates', () => {
      const allRegistries = [
        CREATOR_TEMPLATE_REGISTRY,
        ENGINE_TEMPLATE_REGISTRY,
        PROMPT_TEMPLATE_REGISTRY,
        API_TEMPLATE_REGISTRY,
      ];

      for (const registry of allRegistries) {
        for (const [id, template] of Object.entries(registry)) {
          expect(template.variables).toBeInstanceOf(Array);
          for (const variable of template.variables) {
            expect(variable.name).toBeDefined();
            expect(variable.type).toBeDefined();
            expect(variable.required).toBeDefined();
            expect(variable.description).toBeDefined();
          }
        }
      }
    });

    it('should have example in most templates', () => {
      const allRegistries = [
        CREATOR_TEMPLATE_REGISTRY,
        ENGINE_TEMPLATE_REGISTRY,
        PROMPT_TEMPLATE_REGISTRY,
        API_TEMPLATE_REGISTRY,
      ];

      for (const registry of allRegistries) {
        for (const [id, template] of Object.entries(registry)) {
          // SDK templates and some prompt templates may not have examples
          if (template.example !== undefined) {
            expect(template.example).toBeDefined();
            expect(typeof template.example).toBe('object');
          }
        }
      }
    });
  });
});