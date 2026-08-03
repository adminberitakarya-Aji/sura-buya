import { describe, it, expect } from 'vitest';
import {
  parseFreeTextToPersona,
  buildManualDraft,
  validatePersonaDraft,
  PersonaParseError,
} from '../src/character/persona-parser.js';
import type { AIProvider } from '../src/ai/providers.js';
import type { AIResponse } from '../src/ai/providers.js';

/**
 * Mock AIProvider — tidak memanggil API eksternal. `scriptedContent`
 * dikembalikan persis seolah itu jawaban LLM, supaya kita bisa uji parsing
 * logic secara deterministik.
 */
function createMockProvider(scriptedContent: string, finishReason: AIResponse['finishReason'] = 'stop'): AIProvider {
  return {
    name: 'mock',
    version: '1.0.0',
    async generate(): Promise<AIResponse> {
      return {
        content: scriptedContent,
        finishReason,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'mock-model',
        provider: 'mock',
        latency: 5,
      };
    },
    async *generateStream() {
      yield scriptedContent;
    },
    async isAvailable() {
      return true;
    },
    async getModels() {
      return ['mock-model'];
    },
  };
}

const VALID_PERSONA_JSON = JSON.stringify({
  name: 'kiko',
  displayName: 'Kiko si Kelinci Pemberani',
  role: 'PROTAGONIST',
  species: 'anak kelinci',
  ageDescriptor: 'anak-anak, sekitar 7 tahun',
  description: 'Kiko adalah kelinci kecil yang selalu ingin tahu dan suka menjelajah kebun.',
  coreTraits: ['pemberani', 'ingin tahu', 'ceria'],
  coreWeakness: 'takut gelap',
  motivation: 'ingin membuktikan diri ke kakaknya',
  voiceGuide: 'ceria, cepat bicara, sering pakai kata "wah!"',
  visualDescription: 'kelinci putih dengan telinga panjang, mengenakan syal biru',
});

describe('persona-parser', () => {
  describe('parseFreeTextToPersona', () => {
    it('berhasil strukturisasi free-text jadi PersonaDraft yang valid', async () => {
      const provider = createMockProvider(VALID_PERSONA_JSON);
      const draft = await parseFreeTextToPersona(
        'Kiko itu kelinci kecil pemberani yang suka menjelajah kebun bersama kakaknya.',
        provider,
      );

      expect(draft.source).toBe('ai-parsed');
      expect(draft.name).toBe('kiko');
      expect(draft.displayName).toBe('Kiko si Kelinci Pemberani');
      expect(draft.role).toBe('PROTAGONIST');
      expect(draft.coreTraits).toEqual(['pemberani', 'ingin tahu', 'ceria']);
      expect(draft.rawInput).toContain('Kiko itu kelinci');
      expect(draft.draftId).toBeTruthy();
    });

    it('menangani response yang dibungkus code fence markdown', async () => {
      const fenced = '```json\n' + VALID_PERSONA_JSON + '\n```';
      const provider = createMockProvider(fenced);
      const draft = await parseFreeTextToPersona(
        'Kiko itu kelinci kecil pemberani yang suka menjelajah kebun.',
        provider,
      );
      expect(draft.name).toBe('kiko');
    });

    it('menandai coreWeakness sebagai fieldsNeedingReview kalau tidak ada jejaknya di input asli', async () => {
      const provider = createMockProvider(VALID_PERSONA_JSON);
      // Input asli TIDAK menyebutkan apapun soal "gelap"/ketakutan
      const draft = await parseFreeTextToPersona(
        'Kiko itu kelinci kecil pemberani yang suka menjelajah kebun bersama kakaknya.',
        provider,
      );
      expect(draft.fieldsNeedingReview).toContain('coreWeakness');
    });

    it('melempar PersonaParseError kalau input terlalu pendek', async () => {
      const provider = createMockProvider(VALID_PERSONA_JSON);
      await expect(parseFreeTextToPersona('Kiko', provider)).rejects.toThrow(PersonaParseError);
    });

    it('melempar PersonaParseError kalau provider gagal (finishReason error)', async () => {
      const provider = createMockProvider('', 'error');
      await expect(
        parseFreeTextToPersona('Kiko kelinci kecil yang pemberani dan suka menjelajah.', provider),
      ).rejects.toThrow(PersonaParseError);
    });

    it('melempar PersonaParseError kalau AI mengembalikan JSON tidak valid', async () => {
      const provider = createMockProvider('ini bukan json sama sekali');
      await expect(
        parseFreeTextToPersona('Kiko kelinci kecil yang pemberani dan suka menjelajah.', provider),
      ).rejects.toThrow(PersonaParseError);
    });

    it('melempar PersonaParseError kalau field wajib kosong setelah parsing', async () => {
      const incomplete = JSON.stringify({ name: 'kiko' }); // hampir semua field wajib hilang
      const provider = createMockProvider(incomplete);
      await expect(
        parseFreeTextToPersona('Kiko kelinci kecil yang pemberani dan suka menjelajah.', provider),
      ).rejects.toThrow(PersonaParseError);
    });

    it('TIDAK mengasumsikan audiens anak-anak secara default — system prompt netral kalau audienceProfile tidak diisi', async () => {
      let capturedSystemPrompt = '';
      const provider: AIProvider = {
        name: 'mock',
        version: '1.0.0',
        async generate(_prompt, options) {
          capturedSystemPrompt = (options as { systemPrompt?: string }).systemPrompt ?? '';
          return {
            content: VALID_PERSONA_JSON,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            model: 'mock-model',
            provider: 'mock',
            latency: 5,
          };
        },
        async *generateStream() {
          yield VALID_PERSONA_JSON;
        },
        async isAvailable() {
          return true;
        },
        async getModels() {
          return ['mock-model'];
        },
      };

      await parseFreeTextToPersona('Karakter dewasa muda yang bekerja sebagai detektif.', provider);

      expect(capturedSystemPrompt).not.toMatch(/4-9 tahun/i);
      expect(capturedSystemPrompt).not.toMatch(/khusus (untuk )?anak/i);
      expect(capturedSystemPrompt).toContain('netral');
    });

    it('meneruskan audienceProfile dari universe pemanggil ke system prompt, bukan hardcode di engine', async () => {
      let capturedSystemPrompt = '';
      const provider: AIProvider = {
        name: 'mock',
        version: '1.0.0',
        async generate(_prompt, options) {
          capturedSystemPrompt = (options as { systemPrompt?: string }).systemPrompt ?? '';
          return {
            content: VALID_PERSONA_JSON,
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            model: 'mock-model',
            provider: 'mock',
            latency: 5,
          };
        },
        async *generateStream() {
          yield VALID_PERSONA_JSON;
        },
        async isAvailable() {
          return true;
        },
        async getModels() {
          return ['mock-model'];
        },
      };

      await parseFreeTextToPersona(
        'Karakter untuk cerita horor dewasa.',
        provider,
        'dewasa, tema horor psikologis, boleh menegangkan',
      );

      expect(capturedSystemPrompt).toContain('dewasa, tema horor psikologis, boleh menegangkan');
    });
  });

  describe('buildManualDraft', () => {
    it('membangun PersonaDraft valid dari input form manual tanpa fieldsNeedingReview', () => {
      const draft = buildManualDraft({
        name: 'buya',
        displayName: 'Buya si Buaya Penasaran',
        role: 'DEUTERAGONIST',
        species: 'anak buaya',
        ageDescriptor: 'anak-anak, sekitar 9 tahun',
        description: 'Buya suka bertanya tentang segala hal di sekitar rawa.',
        coreTraits: ['penasaran', 'ramah'],
        coreWeakness: 'ceroboh kalau terburu-buru',
        voiceGuide: 'santai, banyak bertanya',
        visualDescription: 'buaya hijau muda dengan bercak kuning di punggung',
      });

      expect(draft.source).toBe('manual');
      expect(draft.fieldsNeedingReview).toEqual([]);
      expect(draft.name).toBe('buya');
    });

    it('melempar PersonaParseError kalau form manual tidak lengkap', () => {
      expect(() =>
        buildManualDraft({
          name: '',
          displayName: '',
          role: 'SUPPORTING',
          species: '',
          ageDescriptor: '',
          description: '',
          coreTraits: [],
          coreWeakness: '',
          voiceGuide: '',
          visualDescription: '',
        }),
      ).toThrow(PersonaParseError);
    });

    it('sanitasi name jadi slug valid walau user mengetik format bebas di form manual', () => {
      const draft = buildManualDraft({
        name: 'Kiko Si Kelinci!!',
        displayName: 'Kiko si Kelinci Pemberani',
        role: 'PROTAGONIST',
        species: 'anak kelinci',
        ageDescriptor: 'anak-anak, sekitar 7 tahun',
        description: 'Kiko adalah kelinci kecil yang selalu ingin tahu.',
        coreTraits: ['pemberani'],
        coreWeakness: 'takut gelap',
        voiceGuide: 'ceria',
        visualDescription: 'kelinci putih',
      });

      expect(draft.name).toBe('kiko-si-kelinci');
    });
  });

  describe('validatePersonaDraft', () => {
    it('meloloskan draft yang sudah diedit user di Step 2 selama tetap valid', () => {
      const provider = createMockProvider(VALID_PERSONA_JSON);
      void provider; // hanya untuk konsistensi, tidak dipakai di test ini
      const edited = {
        draftId: 'draft-123',
        source: 'ai-parsed',
        name: 'kiko',
        displayName: 'Kiko si Kelinci Pemberani',
        role: 'PROTAGONIST',
        species: 'anak kelinci',
        ageDescriptor: 'anak-anak, sekitar 7 tahun',
        description: 'Kiko adalah kelinci kecil yang selalu ingin tahu.',
        coreTraits: ['pemberani', 'ingin tahu'],
        coreWeakness: 'takut ketinggian', // user koreksi manual di Step 2
        voiceGuide: 'ceria, cepat bicara',
        visualDescription: 'kelinci putih dengan telinga panjang',
        fieldsNeedingReview: ['coreWeakness'],
      };
      const result = validatePersonaDraft(edited);
      expect(result.coreWeakness).toBe('takut ketinggian');
    });

    it('melempar PersonaParseError kalau draft hasil edit user jadi tidak valid', () => {
      expect(() => validatePersonaDraft({ draftId: 'x' })).toThrow(PersonaParseError);
    });

    it('sanitasi name kalau user mengedit slug jadi format tidak valid, BUKAN meloloskannya apa adanya', () => {
      const edited = {
        draftId: 'draft-123',
        source: 'ai-parsed',
        name: 'Kiko Kelinci', // user tidak sengaja edit jadi ada spasi/uppercase
        displayName: 'Kiko si Kelinci Pemberani',
        role: 'PROTAGONIST',
        species: 'anak kelinci',
        ageDescriptor: 'anak-anak, sekitar 7 tahun',
        description: 'Kiko adalah kelinci kecil yang selalu ingin tahu.',
        coreTraits: ['pemberani'],
        coreWeakness: 'takut gelap',
        voiceGuide: 'ceria',
        visualDescription: 'kelinci putih',
        fieldsNeedingReview: [],
      };
      const result = validatePersonaDraft(edited);
      expect(result.name).toBe('kiko-kelinci');
    });

    it('tetap melempar PersonaParseError kalau name jadi string kosong setelah sanitasi (bukan diam-diam lolos)', () => {
      const edited = {
        draftId: 'draft-123',
        source: 'ai-parsed',
        name: '!!!', // sanitasi -> string kosong
        displayName: 'Kiko si Kelinci Pemberani',
        role: 'PROTAGONIST',
        species: 'anak kelinci',
        ageDescriptor: 'anak-anak, sekitar 7 tahun',
        description: 'Kiko adalah kelinci kecil yang selalu ingin tahu.',
        coreTraits: ['pemberani'],
        coreWeakness: 'takut gelap',
        voiceGuide: 'ceria',
        visualDescription: 'kelinci putih',
        fieldsNeedingReview: [],
      };
      expect(() => validatePersonaDraft(edited)).toThrow(PersonaParseError);
    });
  });
});