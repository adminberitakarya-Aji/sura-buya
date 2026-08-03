/**
 * VF-1.9 — Integration Test: Pipeline Pembuatan Karakter End-to-End
 *
 * Menguji seluruh pipeline VF-1 secara terintegrasi (bukan unit per-modul):
 *
 *   Step 1A: parseFreeTextToPersona()    → PersonaDraft  (VF-1.2)
 *   Step 1B: buildManualDraft()          → PersonaDraft  (VF-1.2)
 *   Step 2:  validatePersonaDraft()      → PersonaDraft (lock sebelum simpan)
 *   Step 3a: buildCharacterCreateInput() → CharacterCreateInput (VF-1.5)
 *   Step 3b: buildCharacterAssetCreateInput() → CharacterAssetCreateInput (VF-1.5)
 *   Step 4:  generateCharacterReferenceImages() → ReferenceGeneratorResult (VF-1.6)
 *
 * Prinsip coverage VF-1.9 (sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md):
 *  - Free-text AI → PersonaDraft → koreksi manual di Step 2 → siap simpan
 *  - Jalur manual (tanpa AI) juga terintegrasi penuh sampai ke referensi gambar
 *  - Lintas audienceProfile: pipeline harus berjalan sama, hasil TIDAK di-hardcode
 *    ke tone anak-anak walau tanpa audienceProfile (tidak ada asumsi audiens default)
 *  - Tidak ada regresi ke test unit VF-1.2, VF-1.5, VF-1.6 yang sudah ada
 *
 * Catatan: test ini TIDAK menyentuh database (Prisma). Persistensi
 * ke Postgres diuji lewat route.test.ts di apps/web. Di sini kita
 * validasi integrasi engine-v2 murni (in-memory, deterministik).
 */

import { describe, it, expect } from 'vitest';
import {
  parseFreeTextToPersona,
  buildManualDraft,
  validatePersonaDraft,
  PersonaParseError,
} from '../src/character/persona-parser.js';
import {
  buildCharacterCreateInput,
  buildCharacterAssetCreateInput,
} from '../src/character/character-builder.js';
import {
  generateCharacterReferenceImages,
  buildReferencePrompts,
} from '../src/character/reference-generator.js';
import { MediaProviderRegistry } from '../src/ai/media-providers/registry.js';
import { MockImageProvider } from '../src/ai/media-providers/mock-providers.js';
import type { AIProvider, AIResponse } from '../src/ai/providers.js';
import type { PersonaDraft } from '@suro-buya/shared';

// ---------------------------------------------------------------------------
// Helper: mock AI provider yang mengembalikan JSON persona yang sudah ditentukan
// ---------------------------------------------------------------------------

function createScriptedProvider(personaJson: string, finishReason: AIResponse['finishReason'] = 'stop'): AIProvider {
  return {
    name: 'mock-llm',
    version: '1.0.0',
    isAvailable: async () => true,
    getModels: async () => ['mock-model'],
    generateStream: async function* () { yield personaJson; },
    generate: async (): Promise<AIResponse> => ({
      content: personaJson,
      finishReason,
      usage: { promptTokens: 50, completionTokens: 200, totalTokens: 250 },
      model: 'mock-model',
      provider: 'mock-llm',
      latency: 10,
    }),
  };
}

// Persona JSON yang valid — merepresentasikan output LLM nyata yang sudah di-strukturisasi
const KIKO_PERSONA_JSON = JSON.stringify({
  name: 'kiko',
  displayName: 'Kiko si Kelinci Pemberani',
  role: 'PROTAGONIST',
  species: 'kelinci',
  ageDescriptor: 'anak-anak, sekitar 7 tahun',
  description: 'Kiko adalah kelinci kecil berusia 7 tahun yang selalu ingin tahu dan suka menjelajah kebun ajaib di belakang rumahnya.',
  coreTraits: ['pemberani', 'ingin tahu', 'ceria'],
  coreWeakness: 'takut gelap dan suara keras',
  motivation: 'ingin membuktikan diri ke kakaknya bahwa dia sudah cukup besar',
  voiceGuide: 'ceria, cepat bicara, sering pakai kata "wah!" dan "ayo kita coba!"',
  visualDescription: 'kelinci putih berbulu lembut dengan syal merah kebanggaan, telinga panjang, mata biru jernih',
});

// Persona untuk universe MATURE (dewasa) — harus bisa berbeda nada, tidak di-sanitize ke anak-anak
const ARKON_PERSONA_JSON = JSON.stringify({
  name: 'arkon',
  displayName: 'Arkon sang Penjaga Kegelapan',
  role: 'ANTAGONIST',
  species: 'manusia',
  ageDescriptor: 'dewasa paruh baya, awal 40-an',
  description: 'Arkon adalah mantan agen rahasia yang memilih sisi gelap setelah dikhianati organisasinya. Dingin, kalkulatif, dan berbahaya.',
  coreTraits: ['dingin', 'kalkulatif', 'tidak sentimental'],
  coreWeakness: 'trauma masa lalu yang belum sembuh, sulit mempercayai siapapun',
  motivation: 'membalas dendam terhadap organisasi yang menghancurkan hidupnya',
  voiceGuide: 'nada datar dan terukur, jarang bicara tapi setiap kata berbobot',
  visualDescription: 'pria berkulit coklat gelap, rambut abu-abu pendek, selalu memakai mantel hitam panjang dan kacamata cermin',
});

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('VF-1.9 — Integration: Pipeline Pembuatan Karakter End-to-End', () => {

  // --------------------------------------------------------------------------
  // Suite A: Jalur AI Parsing (Step 1 Opsi A → Step 2 → Step 3)
  // --------------------------------------------------------------------------

  describe('Jalur A — Free-Text AI (Step 1 Opsi A) → Review/Lock → Character Bible + Asset', () => {
    it('A1: parseFreeTextToPersona() menghasilkan PersonaDraft valid dari free-text (universe ALL_AGES)', async () => {
      const provider = createScriptedProvider(KIKO_PERSONA_JSON);

      const draft = await parseFreeTextToPersona(
        'Kiko adalah kelinci kecil berusia 7 tahun yang pemberani dan selalu ingin tahu',
        provider,
        'keluarga Indonesia, konten edukatif untuk anak usia 5-8 tahun',
      );

      expect(draft.source).toBe('ai-parsed');
      expect(draft.draftId).toBeTruthy();
      expect(draft.name).toBe('kiko');
      expect(draft.displayName).toBe('Kiko si Kelinci Pemberani');
      expect(draft.role).toBe('PROTAGONIST');
      expect(draft.species).toBe('kelinci');
      expect(draft.coreTraits).toContain('pemberani');
      expect(draft.coreWeakness).toBeTruthy();
      expect(draft.visualDescription).toContain('merah');
    });

    it('A2: persona universe MATURE (dewasa) tidak di-sanitize/diperhalus — tone tetap sesuai genre dewasa', async () => {
      const provider = createScriptedProvider(ARKON_PERSONA_JSON);

      const draft = await parseFreeTextToPersona(
        'Arkon adalah mantan agen yang berkhianat, dingin dan berbahaya, genre noir dewasa',
        provider,
        'dewasa 18+, genre thriller noir, tidak ada sensor',
      );

      // Persona TIDAK di-filter/sanitize menjadi ramah-anak meski tidak ada
      // default asumsi — engine bersifat generik, menghormati audienceProfile universe
      expect(draft.name).toBe('arkon');
      expect(draft.role).toBe('ANTAGONIST');
      expect(draft.coreTraits).toContain('dingin');
      // Trait "pemberani" (anak-anak) tidak seharusnya muncul di karakter dewasa ini
      expect(draft.coreTraits).not.toContain('polos');
      expect(draft.coreTraits).not.toContain('ramah');
      expect(draft.motivation).toContain('balas dendam');
    });

    it('A3: PersonaDraft hasil AI dapat diedit (Step 2) dan tetap lolos validatePersonaDraft()', async () => {
      const provider = createScriptedProvider(KIKO_PERSONA_JSON);
      const draft = await parseFreeTextToPersona(
        'Kiko adalah kelinci kecil yang sangat pemberani dan selalu ingin tahu hal-hal baru di sekitarnya.',
        provider,
        'keluarga',
      );

      // Simulasi user mengedit di Step 2: ubah displayName dan tambah trait
      const editedDraft: PersonaDraft = {
        ...draft,
        displayName: 'Kiko si Kelinci Super',
        coreTraits: [...draft.coreTraits, 'setia kawan'],
        fieldsNeedingReview: [], // user sudah review semua
      };

      // validatePersonaDraft() — lock sebelum kirim ke character-builder
      const locked = validatePersonaDraft(editedDraft);
      expect(locked.displayName).toBe('Kiko si Kelinci Super');
      expect(locked.coreTraits).toContain('setia kawan');
      expect(locked.fieldsNeedingReview).toHaveLength(0);
    });

    it('A4: PersonaDraft yang sudah di-lock → buildCharacterCreateInput() menghasilkan CharacterCreateInput siap-simpan', async () => {
      const provider = createScriptedProvider(KIKO_PERSONA_JSON);
      const draft = await parseFreeTextToPersona(
        'Kiko adalah kelinci kecil yang sangat pemberani dan suka menjelajahi kebun ajaib setiap hari.',
        provider,
      );
      const locked = validatePersonaDraft(draft);

      const charInput = buildCharacterCreateInput(locked);

      // Field Prisma langsung
      expect(charInput.characterId).toBe('kiko');
      expect(charInput.displayName).toBe('Kiko si Kelinci Pemberani');
      expect(charInput.role).toBe('PROTAGONIST');
      expect(charInput.coreTraits).toContain('pemberani');
      expect(charInput.coreWeakness).toBeTruthy();
      expect(charInput.voiceGuide).toBeTruthy();

      // Field non-Prisma → masuk metadata
      expect(charInput.metadata.species).toBe('kelinci');
      expect(charInput.metadata.ageDescriptor).toContain('7 tahun');
      expect(charInput.metadata.visualDescription).toContain('syal merah');
      expect(charInput.metadata.personaSource).toBe('ai-parsed');
    });

    it('A5: buildCharacterAssetCreateInput() menghasilkan asset kosong siap diisi VF-1.6 di Step 3', async () => {
      const assetInput = buildCharacterAssetCreateInput();

      expect(assetInput.referenceImages).toEqual([]);
      expect(assetInput.voiceProfile).toBeNull();
    });

    it('A6: generateCharacterReferenceImages() via MockImageProvider menghasilkan N URL gambar', async () => {
      const provider = createScriptedProvider(KIKO_PERSONA_JSON);
      const draft = await parseFreeTextToPersona(
        'Kiko adalah kelinci kecil yang selalu ingin tahu dan penuh petualangan.',
        provider,
      );

      const registry = new MediaProviderRegistry();
      const mockImg = new MockImageProvider('flux-mock');
      registry.registerImageProvider(mockImg);
      registry.setImageChain(['flux-mock']);

      const result = await generateCharacterReferenceImages({
        characterId: draft.name,
        persona: draft,
        count: 4,
        artStyle: '2D digital character illustration, vibrant colors',
        registry,
      });

      expect(result.referenceImages).toHaveLength(4);
      expect(result.promptsUsed).toHaveLength(4);
      expect(result.providerUsed).toBe('flux-mock');
      // Setiap URL harus berupa string non-kosong
      result.referenceImages.forEach((url) => expect(url).toBeTruthy());
      // Setiap prompt harus menyebut karakter
      result.promptsUsed.forEach((s) => expect(s.prompt).toContain('Kiko si Kelinci Pemberani'));
    });

    it('A7: pipeline full AI → CharacterCreateInput BERHASIL dijalankan secara berantai tanpa error', async () => {
      const provider = createScriptedProvider(KIKO_PERSONA_JSON);
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('kling-mock'));
      registry.setImageChain(['kling-mock']);

      // Step 1A: Parse
      const draft = await parseFreeTextToPersona(
        'Kiko adalah anak kelinci yang pemberani dan selalu ingin tahu hal baru.',
        provider,
        'keluarga, anak usia dini',
      );
      // Step 2: Lock
      const locked = validatePersonaDraft(draft);
      // Step 3a: Character Bible input
      const charInput = buildCharacterCreateInput(locked);
      // Step 3b: Asset input
      const assetInput = buildCharacterAssetCreateInput();
      // Step 4: Reference images
      const refResult = await generateCharacterReferenceImages({
        characterId: charInput.characterId,
        persona: locked,
        count: 3,
        registry,
      });

      // Semua step berhasil — verifikasi integritas data lintas step
      expect(charInput.characterId).toBe(locked.name);
      expect(assetInput.referenceImages).toEqual([]); // kosong sebelum Step 4
      expect(refResult.referenceImages).toHaveLength(3);
      expect(refResult.characterId).toBe(charInput.characterId);
    });
  });

  // --------------------------------------------------------------------------
  // Suite B: Jalur Manual (Step 1 Opsi B → Step 2 → Step 3)
  // --------------------------------------------------------------------------

  describe('Jalur B — Form Manual (Step 1 Opsi B) → Review/Lock → Character Bible + Asset', () => {
    const MANUAL_INPUT = {
      name: 'buya',
      displayName: 'Buya si Buaya Bijaksana',
      role: 'DEUTERAGONIST' as const,
      species: 'buaya',
      ageDescriptor: 'dewasa, tampak berwibawa',
      description: 'Buya adalah buaya tua yang bijaksana dan menjadi penasihat Kiko dalam setiap petualangan.',
      coreTraits: ['bijaksana', 'sabar', 'humoris'],
      coreWeakness: 'terlalu sering meragukan kemampuan diri sendiri',
      voiceGuide: 'suara dalam dan berwibawa, berbicara pelan dan terukur',
      visualDescription: 'buaya besar berwarna hijau tua dengan kacamata bulat dan selalu membawa tongkat kayu',
    };

    it('B1: buildManualDraft() menghasilkan PersonaDraft valid tanpa AI', () => {
      const draft = buildManualDraft(MANUAL_INPUT);

      expect(draft.source).toBe('manual');
      expect(draft.draftId).toBeTruthy();
      expect(draft.name).toBe('buya');
      expect(draft.fieldsNeedingReview).toHaveLength(0); // manual = tidak ada field yang perlu dicek
    });

    it('B2: draft manual bisa langsung di-lock via validatePersonaDraft() tanpa edit', () => {
      const draft = buildManualDraft(MANUAL_INPUT);
      const locked = validatePersonaDraft(draft);

      expect(locked.name).toBe('buya');
      expect(locked.role).toBe('DEUTERAGONIST');
      expect(locked.metadata).toBeUndefined(); // metadata hanya ada di CharacterCreateInput, bukan PersonaDraft
    });

    it('B3: CharacterCreateInput dari draft manual menyimpan field non-Prisma ke metadata', () => {
      const draft = buildManualDraft(MANUAL_INPUT);
      const locked = validatePersonaDraft(draft);
      const input = buildCharacterCreateInput(locked);

      expect(input.characterId).toBe('buya');
      expect(input.metadata.species).toBe('buaya');
      expect(input.metadata.ageDescriptor).toContain('dewasa');
      expect(input.metadata.visualDescription).toContain('kacamata bulat');
      expect(input.metadata.personaSource).toBe('manual');
      expect(input.metadata.motivation).toBeNull(); // tidak diisi di form
    });

    it('B4: pipeline manual full BERHASIL dijalankan tanpa error sampai Step 4 (reference images)', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('wan-mock'));
      registry.setImageChain(['wan-mock']);

      // Step 1B: Manual draft
      const draft = buildManualDraft(MANUAL_INPUT);
      // Step 2: Lock
      const locked = validatePersonaDraft(draft);
      // Step 3a+3b
      const charInput = buildCharacterCreateInput(locked);
      const assetInput = buildCharacterAssetCreateInput();
      // Step 4
      const refResult = await generateCharacterReferenceImages({
        characterId: charInput.characterId,
        persona: locked,
        count: 4,
        artStyle: '2D digital, watercolor style, Indonesian children book illustration',
        registry,
      });

      expect(charInput.characterId).toBe('buya');
      expect(assetInput.referenceImages).toEqual([]);
      expect(refResult.referenceImages).toHaveLength(4);
      expect(refResult.promptsUsed[0].prompt).toContain('Buya si Buaya Bijaksana');
    });
  });

  // --------------------------------------------------------------------------
  // Suite C: Error Handling & Edge Cases
  // --------------------------------------------------------------------------

  describe('Error Handling — edge cases pipeline VF-1', () => {
    it('C1: parseFreeTextToPersona() melempar PersonaParseError jika AI mengembalikan JSON tidak valid', async () => {
      const provider = createScriptedProvider('ini bukan JSON {{ rusak }}');
      await expect(
        parseFreeTextToPersona('deskripsi apa saja', provider),
      ).rejects.toThrow(PersonaParseError);
    });

    it('C2: parseFreeTextToPersona() melempar PersonaParseError jika input terlalu pendek', async () => {
      const provider = createScriptedProvider(KIKO_PERSONA_JSON);
      await expect(
        parseFreeTextToPersona('singkat', provider),
      ).rejects.toThrow(PersonaParseError);
    });

    it('C3: parseFreeTextToPersona() melempar PersonaParseError jika AI menjawab bukan stop (error finish)', async () => {
      const provider = createScriptedProvider('', 'error');
      await expect(
        parseFreeTextToPersona('deskripsi yang valid untuk diuji', provider),
      ).rejects.toThrow(PersonaParseError);
    });

    it('C4: validatePersonaDraft() melempar jika field wajib tidak ada (mis. coreTraits kosong)', () => {
      const badDraft = {
        draftId: 'x',
        source: 'manual',
        name: 'x',
        displayName: 'X',
        role: 'SUPPORTING',
        species: 'manusia',
        ageDescriptor: 'dewasa',
        description: 'Test character',
        coreTraits: [], // wajib minimal 1
        coreWeakness: 'tidak ada',
        voiceGuide: 'normal',
        visualDescription: 'biasa saja',
        fieldsNeedingReview: [],
      };
      expect(() => validatePersonaDraft(badDraft)).toThrow();
    });

    it('C5: generateCharacterReferenceImages() melempar jika visualDescription kosong', async () => {
      const draftTanpaVisual: PersonaDraft = {
        draftId: 'x',
        source: 'manual',
        name: 'test',
        displayName: 'Test',
        role: 'SUPPORTING',
        species: 'manusia',
        ageDescriptor: 'dewasa',
        description: 'Test character',
        coreTraits: ['ramah'],
        coreWeakness: 'tidak ada',
        voiceGuide: 'normal',
        visualDescription: '', // sengaja kosong
        fieldsNeedingReview: [],
      };

      await expect(
        generateCharacterReferenceImages({ persona: draftTanpaVisual }),
      ).rejects.toThrow();
    });

    it('C6: slug sanitization — name dengan spasi/kapital di-normalize ke lowercase slug', () => {
      const draft = buildManualDraft({
        ...{
          name: 'Kiko Kelinci Besar',
          displayName: 'Kiko',
          role: 'PROTAGONIST' as const,
          species: 'kelinci',
          ageDescriptor: 'anak-anak',
          description: 'Karakter test slug sanitization',
          coreTraits: ['pemberani'],
          coreWeakness: 'mudah takut',
          voiceGuide: 'ceria',
          visualDescription: 'kelinci putih',
        },
      });
      // Slug harus lowercase dengan tanda hubung, tanpa spasi
      expect(draft.name).toMatch(/^[a-z0-9-]+$/);
      expect(draft.name).not.toContain(' ');
    });

    it('C7: pipeline dual-karakter — Kiko (ALL_AGES) & Arkon (MATURE) bisa berjalan paralel, hasilnya independen', async () => {
      const kikoProvider = createScriptedProvider(KIKO_PERSONA_JSON);
      const arkonProvider = createScriptedProvider(ARKON_PERSONA_JSON);

      const [kikoDraft, arkonDraft] = await Promise.all([
        parseFreeTextToPersona('Kiko kelinci anak-anak', kikoProvider, 'all ages, family'),
        parseFreeTextToPersona('Arkon agen dewasa thriller', arkonProvider, 'mature 18+, noir'),
      ]);

      // Dua karakter diproses independen, tidak saling mengkontaminasi
      expect(kikoDraft.name).toBe('kiko');
      expect(arkonDraft.name).toBe('arkon');
      expect(kikoDraft.role).toBe('PROTAGONIST');
      expect(arkonDraft.role).toBe('ANTAGONIST');
      expect(kikoDraft.species).toBe('kelinci');
      expect(arkonDraft.species).toBe('manusia');

      // Buat CharacterCreateInput keduanya — tidak ada conflict
      const kikoInput = buildCharacterCreateInput(kikoDraft);
      const arkonInput = buildCharacterCreateInput(arkonDraft);

      expect(kikoInput.characterId).not.toBe(arkonInput.characterId);
      expect(kikoInput.metadata.personaSource).toBe('ai-parsed');
      expect(arkonInput.metadata.personaSource).toBe('ai-parsed');
    });
  });

  // --------------------------------------------------------------------------
  // Suite D: buildReferencePrompts — pengujian integrasi prompt builder
  // --------------------------------------------------------------------------

  describe('Reference Prompts — integrasi buildReferencePrompts dengan persona pipeline', () => {
    it('D1: prompt yang dihasilkan dari PersonaDraft manual mengandung semua field visual kunci', () => {
      const draft = buildManualDraft({
        name: 'buya',
        displayName: 'Buya si Buaya',
        role: 'DEUTERAGONIST',
        species: 'buaya hijau',
        ageDescriptor: 'dewasa tua berwibawa',
        description: 'Penasihat bijak',
        coreTraits: ['bijaksana', 'sabar'],
        coreWeakness: 'ragu diri sendiri',
        voiceGuide: 'suara dalam berwibawa',
        visualDescription: 'buaya hijau tua berukuran besar dengan kacamata antik dan tongkat kayu ukir',
      });

      const prompts = buildReferencePrompts({
        displayName: draft.displayName,
        species: draft.species,
        ageDescriptor: draft.ageDescriptor,
        visualDescription: draft.visualDescription,
        coreTraits: draft.coreTraits,
        artStyle: 'flat design, Indonesian cartoon style',
      });

      expect(prompts).toHaveLength(4);
      prompts.forEach((p) => {
        expect(p.prompt).toContain('Buya si Buaya');
        expect(p.prompt).toContain('buaya hijau');
        expect(p.prompt).toContain('kacamata antik');
        expect(p.prompt).toContain('flat design');
      });
    });

    it('D2: artStyle default digunakan jika tidak disuplai — prompt tetap mengandung style token', () => {
      const prompts = buildReferencePrompts({
        displayName: 'Kiko',
        species: 'kelinci',
        ageDescriptor: 'anak-anak',
        visualDescription: 'kelinci putih dengan syal merah',
      });

      // artStyle default: '2D digital character illustration...'
      prompts.forEach((p) => {
        expect(p.prompt).toContain('2D digital character illustration');
      });
    });
  });
});
