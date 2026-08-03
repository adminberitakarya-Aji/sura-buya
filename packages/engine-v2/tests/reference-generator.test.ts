import { describe, it, expect } from 'vitest';
import {
  buildReferencePrompts,
  generateCharacterReferenceImages,
  ReferenceGeneratorError,
} from '../src/character/reference-generator.js';
import { MediaProviderRegistry } from '../src/ai/media-providers/registry.js';
import { MockImageProvider } from '../src/ai/media-providers/mock-providers.js';
import type { PersonaDraft } from '@suro-buya/shared';

describe('reference-generator (VF-1.6)', () => {
  const samplePersona: PersonaDraft = {
    draftId: 'draft-123',
    source: 'ai-parsed',
    name: 'kiko',
    displayName: 'Kiko si Kelinci',
    role: 'PROTAGONIST',
    species: 'Kelinci',
    ageDescriptor: 'anak-anak, sekitar 8 tahun',
    description: 'Kiko adalah kelinci kecil yang pemberani dan selalu ingin tahu hal baru.',
    coreTraits: ['pemberani', 'ramah', 'rasa ingin tahu tinggi'],
    coreWeakness: 'mudah ceroboh saat terlalu bersemangat',
    voiceGuide: 'suara anak-anak riang dengan nada ceria',
    visualDescription: 'Kelinci putih berbulu lembut dengan syal merah di lehernya dan mata biru jernih.',
    fieldsNeedingReview: [],
  };

  describe('buildReferencePrompts', () => {
    it('menghasilkan 4 prompt default dengan sudut pandang berbeda', () => {
      const specs = buildReferencePrompts({
        displayName: samplePersona.displayName,
        species: samplePersona.species,
        ageDescriptor: samplePersona.ageDescriptor,
        visualDescription: samplePersona.visualDescription,
        coreTraits: samplePersona.coreTraits,
      });

      expect(specs).toHaveLength(4);
      expect(specs[0].angle).toBe('front-portrait');
      expect(specs[1].angle).toBe('side-profile');
      expect(specs[2].angle).toBe('full-body');
      expect(specs[3].angle).toBe('action-expression');

      specs.forEach((s) => {
        expect(s.prompt).toContain('Kiko si Kelinci');
        expect(s.prompt).toContain('Kelinci');
        expect(s.prompt).toContain('syal merah');
      });
    });

    it('mendukung kustomisasi jumlah prompt (3 hingga 5)', () => {
      const specs3 = buildReferencePrompts(
        {
          displayName: samplePersona.displayName,
          species: samplePersona.species,
          ageDescriptor: samplePersona.ageDescriptor,
          visualDescription: samplePersona.visualDescription,
        },
        3,
      );
      expect(specs3).toHaveLength(3);

      const specs5 = buildReferencePrompts(
        {
          displayName: samplePersona.displayName,
          species: samplePersona.species,
          ageDescriptor: samplePersona.ageDescriptor,
          visualDescription: samplePersona.visualDescription,
        },
        5,
      );
      expect(specs5).toHaveLength(5);
      expect(specs5[4].angle).toBe('back-detail');
    });

    it('menyertakan artStyle kustom jika disuplai', () => {
      const specs = buildReferencePrompts(
        {
          displayName: samplePersona.displayName,
          species: samplePersona.species,
          ageDescriptor: samplePersona.ageDescriptor,
          visualDescription: samplePersona.visualDescription,
          artStyle: '3D Pixar style render, soft lighting',
        },
        3,
      );

      expect(specs[0].prompt).toContain('3D Pixar style render, soft lighting');
    });
  });

  describe('generateCharacterReferenceImages', () => {
    it('generate reference images dari persona draft dengan provider mock default', async () => {
      const result = await generateCharacterReferenceImages({
        characterId: 'kiko',
        persona: samplePersona,
        count: 4,
      });

      expect(result.characterId).toBe('kiko');
      expect(result.referenceImages).toHaveLength(4);
      expect(result.promptsUsed).toHaveLength(4);
      expect(result.providerUsed).toBe('flux-2-pro');
      expect(result.attempts).toEqual(['flux-2-pro']);
      expect(result.totalCost).toBe(0.04);

      result.referenceImages.forEach((url) => {
        expect(url).toContain('https://mock-media.local/image/flux-2-pro/');
      });
    });

    it('memakai registry dan provider kustom dengan cost & attempts tercatat', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(
        new MockImageProvider('nano-banana-2', { costUsd: 0.025 }),
      );
      registry.setImageChain(['nano-banana-2']);

      const result = await generateCharacterReferenceImages({
        characterId: 'kiko',
        persona: samplePersona,
        count: 3,
        registry,
      });

      expect(result.referenceImages).toHaveLength(3);
      expect(result.providerUsed).toBe('nano-banana-2');
      expect(result.attempts).toEqual(['nano-banana-2']);
      expect(result.totalCost).toBe(0.075);
    });

    it('melempar ReferenceGeneratorError jika visualDescription kosong', async () => {
      const invalidPersona = {
        ...samplePersona,
        visualDescription: '   ',
      };

      await expect(
        generateCharacterReferenceImages({
          persona: invalidPersona,
        }),
      ).rejects.toThrow(ReferenceGeneratorError);
    });
  });
});
