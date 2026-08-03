import { describe, it, expect } from 'vitest';
import {
  buildCharacterCreateInput,
  buildCharacterAssetCreateInput,
  CharacterBuildError,
} from '../src/character/character-builder.js';
import type { PersonaDraft } from '@suro-buya/shared';

const VALID_DRAFT: PersonaDraft = {
  draftId: 'draft-1',
  source: 'manual',
  name: 'kiko',
  displayName: 'Kiko si Kelinci Pemberani',
  role: 'PROTAGONIST',
  species: 'anak kelinci',
  ageDescriptor: 'anak-anak, sekitar 7 tahun',
  description: 'Kiko adalah kelinci kecil yang selalu ingin tahu.',
  coreTraits: ['pemberani', 'ingin tahu'],
  coreWeakness: 'takut gelap',
  motivation: 'ingin membuktikan diri ke kakaknya',
  voiceGuide: 'ceria, cepat bicara',
  visualDescription: 'kelinci putih dengan telinga panjang, mengenakan syal biru',
  fieldsNeedingReview: [],
};

describe('character-builder', () => {
  describe('buildCharacterCreateInput', () => {
    it('memetakan field PersonaDraft ke kolom Character yang punya kolom Prisma langsung', () => {
      const input = buildCharacterCreateInput(VALID_DRAFT);

      expect(input.characterId).toBe('kiko'); // dari draft.name (slug)
      expect(input.name).toBe('Kiko si Kelinci Pemberani'); // dari draft.displayName
      expect(input.displayName).toBe('Kiko si Kelinci Pemberani');
      expect(input.role).toBe('PROTAGONIST');
      expect(input.description).toBe('Kiko adalah kelinci kecil yang selalu ingin tahu.');
      expect(input.coreTraits).toEqual(['pemberani', 'ingin tahu']);
      expect(input.coreWeakness).toBe('takut gelap');
      expect(input.voiceGuide).toBe('ceria, cepat bicara');
    });

    it('menaruh field yang tidak punya kolom Prisma langsung (species, ageDescriptor, motivation, visualDescription) ke metadata', () => {
      const input = buildCharacterCreateInput(VALID_DRAFT);

      expect(input.metadata.species).toBe('anak kelinci');
      expect(input.metadata.ageDescriptor).toBe('anak-anak, sekitar 7 tahun');
      expect(input.metadata.motivation).toBe('ingin membuktikan diri ke kakaknya');
      expect(input.metadata.visualDescription).toContain('kelinci putih');
      expect(input.metadata.personaSource).toBe('manual');
    });

    it('motivation jadi null di metadata kalau tidak diisi di draft (bukan undefined, supaya konsisten disimpan sebagai Prisma Json)', () => {
      const draftTanpaMotivation: PersonaDraft = { ...VALID_DRAFT, motivation: undefined };
      const input = buildCharacterCreateInput(draftTanpaMotivation);
      expect(input.metadata.motivation).toBeNull();
    });

    it('melempar CharacterBuildError kalau draft tidak valid (mis. coreTraits kosong)', () => {
      const draftTidakValid = { ...VALID_DRAFT, coreTraits: [] };
      expect(() => buildCharacterCreateInput(draftTidakValid)).toThrow(CharacterBuildError);
    });

    it('melempar CharacterBuildError kalau draft berasal dari objek yang sudah rusak/tidak lengkap', () => {
      expect(() => buildCharacterCreateInput({ draftId: 'x' } as unknown as PersonaDraft)).toThrow(
        CharacterBuildError,
      );
    });
  });

  describe('buildCharacterAssetCreateInput', () => {
    it('menghasilkan CharacterAsset kosong (referenceImages belum ada, diisi belakangan di VF-1.6)', () => {
      const input = buildCharacterAssetCreateInput();
      expect(input.referenceImages).toEqual([]);
      expect(input.voiceProfile).toBeNull();
    });
  });
});