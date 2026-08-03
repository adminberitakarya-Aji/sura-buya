/**
 * Tests for VF-2.2 — script-generator.ts
 *
 * Uses a mock AIProvider to test script generation without real API calls.
 * Pattern follows persona-parser.test.ts (VF-1.2).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateScript,
  buildSeriesContextPrompt,
  ScriptGenerationError,
  type ScriptGeneratorInput,
  type SeriesContext,
} from '../src/script/script-generator.js';
import type { AIProvider, AIResponse, AIProviderOptions } from '../src/ai/providers.js';
import type { VideoCharacterContext } from '@suro-buya/shared';

// ============================================================
// Mock AI Provider
// ============================================================

class MockScriptProvider implements AIProvider {
  readonly name = 'mock-script';
  readonly version = '1.0.0';

  private responseContent: string;

  constructor(responseContent: string) {
    this.responseContent = responseContent;
  }

  async generate(prompt: string, options: AIProviderOptions): Promise<AIResponse> {
    return {
      content: this.responseContent,
      finishReason: 'stop',
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
      model: 'mock-model',
      provider: this.name,
      latency: 50,
    };
  }

  async *generateStream(prompt: string, options: AIProviderOptions): AsyncIterable<string> {
    yield this.responseContent;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getModels(): Promise<string[]> {
    return ['mock-model'];
  }
}

class MockErrorProvider implements AIProvider {
  readonly name = 'mock-error';
  readonly version = '1.0.0';

  async generate(prompt: string, options: AIProviderOptions): Promise<AIResponse> {
    return {
      content: '',
      finishReason: 'error',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock-error',
      provider: this.name,
      latency: 10,
    };
  }

  async *generateStream(): AsyncIterable<string> {
    yield '';
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getModels(): Promise<string[]> {
    return [];
  }
}

// ============================================================
// Test fixtures
// ============================================================

const mockCharacter: VideoCharacterContext = {
  id: 'char-001',
  characterId: 'suro',
  displayName: 'Suro si Hiu Kecil',
  role: 'PROTAGONIST',
  description: 'Hiu kecil yang pemberani dan ingin tahu',
  coreTraits: ['pemberani', 'ingin tahu', 'setia kawan'],
  coreWeakness: 'Takut pada gelap',
  voiceGuide: 'Cara bicara ceria dan semangat, kadang terbata-bata kalau gugup',
  metadata: {
    species: 'anak hiu',
    ageDescriptor: 'anak-anak, sekitar 9 tahun',
    motivation: 'Ingin membuktikan bahwa hiu kecil juga bisa jadi pahlawan',
    visualDescription: 'Hiu kecil biru dengan mata besar dan senyum lebar',
    personaSource: 'ai-parsed',
  },
};

const mockScriptResponse = `Judul: Suro dan Harta Karun

[Beat 1: Hook]
[Suro berenang menyusuri terumbu karang yang berwarna-warni]
SURO: "Wow, lihat itu! Ada cahaya emas di dasar laut!"

[Beat 2: Conflict]
[Tiba-tiba hiu besar muncul dari kegelapan]
SURO: "A-aku takut... tapi aku harus berani!"
[Suro mengumpulkan keberanian dan menghadapi hiu besar]

[Beat 3: Punchline]
[Ternyata cahaya emas itu cuma kerang yang memantulkan sinar matahari]
SURO: "Haha, ternyata bukan harta karun! Tapi petualangan ini sendiri yang berharga!"`;

// ============================================================
// Tests
// ============================================================

describe('script-generator — generateScript', () => {
  it('should generate script with valid response', async () => {
    const provider = new MockScriptProvider(mockScriptResponse);
    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro menemukan harta karun',
      targetDuration: 15,
      contentRating: 'ALL_AGES',
    };

    const result = await generateScript(input, provider);

    expect(result.script).toBeTruthy();
    expect(result.script.length).toBeGreaterThan(20);
    expect(result.title).toBe('Suro dan Harta Karun');
    expect(result.estimatedDuration).toBeGreaterThan(0);
    expect(result.beatSheet.duration).toBe(15);
    expect(result.beatSheet.totalBeats).toBe(3);
    expect(result.metadata.providerUsed).toBe('mock-script');
    expect(result.metadata.tokensUsed).toBe(300);
  });

  it('should throw error for too short story idea', async () => {
    const provider = new MockScriptProvider(mockScriptResponse);
    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'ok',
      targetDuration: 15,
      contentRating: 'ALL_AGES',
    };

    await expect(generateScript(input, provider)).rejects.toThrow(ScriptGenerationError);
  });

  it('should throw error when AI provider returns error', async () => {
    const provider = new MockErrorProvider();
    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro berpetualang di laut dalam',
      targetDuration: 30,
      contentRating: 'ALL_AGES',
    };

    await expect(generateScript(input, provider)).rejects.toThrow(ScriptGenerationError);
  });

  it('should throw error when script is too short', async () => {
    const provider = new MockScriptProvider('Judul: Test\n\nSingkat.');
    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro bermain',
      targetDuration: 15,
      contentRating: 'ALL_AGES',
    };

    await expect(generateScript(input, provider)).rejects.toThrow(ScriptGenerationError);
  });

  it('should generate beat sheet for 30-second video', async () => {
    const provider = new MockScriptProvider(mockScriptResponse);
    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro belajar tentang keberanian',
      targetDuration: 30,
      contentRating: 'ALL_AGES',
    };

    const result = await generateScript(input, provider);
    expect(result.beatSheet.duration).toBe(30);
    expect(result.beatSheet.totalBeats).toBe(5);
  });

  it('should generate beat sheet for 60-second video', async () => {
    const provider = new MockScriptProvider(mockScriptResponse);
    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro menghadapi tantangan terbesar dalam hidupnya',
      targetDuration: 60,
      contentRating: 'TEEN',
    };

    const result = await generateScript(input, provider);
    expect(result.beatSheet.duration).toBe(60);
    expect(result.beatSheet.totalBeats).toBe(7);
  });

  it('should include character info in system prompt', async () => {
    const generateSpy = vi.fn();
    const provider: AIProvider = {
      name: 'mock-spy',
      version: '1.0.0',
      generate: async (prompt: string, options: AIProviderOptions) => {
        generateSpy(prompt, options);
        return {
          content: mockScriptResponse,
          finishReason: 'stop' as const,
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          model: 'mock-model',
          provider: 'mock-spy',
          latency: 50,
        };
      },
      generateStream: async function* () { yield ''; },
      isAvailable: async () => true,
      getModels: async () => ['mock-model'],
    };

    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro menemukan teman baru',
      targetDuration: 15,
      contentRating: 'ALL_AGES',
      audienceProfile: 'keluarga Indonesia, tema edukatif',
    };

    await generateScript(input, provider);

    expect(generateSpy).toHaveBeenCalledOnce();
    const [prompt, options] = generateSpy.mock.calls[0];
    // System prompt should contain character info
    expect(options.systemPrompt).toContain('Suro si Hiu Kecil');
    expect(options.systemPrompt).toContain('pemberani');
    expect(options.systemPrompt).toContain('Takut pada gelap');
    // User prompt should contain story idea
    expect(prompt).toContain('Suro menemukan teman baru');
  });

  it('should include rating guideline in system prompt', async () => {
    const generateSpy = vi.fn();
    const provider: AIProvider = {
      name: 'mock-spy',
      version: '1.0.0',
      generate: async (prompt: string, options: AIProviderOptions) => {
        generateSpy(prompt, options);
        return {
          content: mockScriptResponse,
          finishReason: 'stop' as const,
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          model: 'mock-model',
          provider: 'mock-spy',
          latency: 50,
        };
      },
      generateStream: async function* () { yield ''; },
      isAvailable: async () => true,
      getModels: async () => ['mock-model'],
    };

    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro menghadapi bahaya',
      targetDuration: 15,
      contentRating: 'MATURE',
    };

    await generateScript(input, provider);

    const [, options] = generateSpy.mock.calls[0];
    expect(options.systemPrompt).toContain('MATURE');
  });
});

describe('script-generator — buildSeriesContextPrompt', () => {
  it('should return first episode message when no previous episodes', () => {
    const ctx: SeriesContext = {
      seriesId: 'series-001',
      episodeOrder: 1,
      previousEpisodes: [],
    };

    const result = buildSeriesContextPrompt(ctx);
    expect(result).toContain('episode pertama');
    expect(result).toContain('episode 1');
  });

  it('should include previous episode summaries', () => {
    const ctx: SeriesContext = {
      seriesId: 'series-001',
      episodeOrder: 2,
      previousEpisodes: [
        {
          episodeOrder: 1,
          title: 'Suro dan Harta Karun',
          script: 'Naskah lengkap episode 1...',
          summary: 'Suro menemukan harta karun yang ternyata cuma kerang kosong',
        },
      ],
    };

    const result = buildSeriesContextPrompt(ctx);
    expect(result).toContain('episode 2');
    expect(result).toContain('Episode 1');
    expect(result).toContain('Suro dan Harta Karun');
    expect(result).toContain('kerang kosong');
    expect(result).toContain('continuity');
  });

  it('should include multiple previous episodes', () => {
    const ctx: SeriesContext = {
      seriesId: 'series-001',
      episodeOrder: 3,
      previousEpisodes: [
        {
          episodeOrder: 1,
          title: 'Episode 1',
          script: 'Naskah 1...',
          summary: 'Summary 1',
        },
        {
          episodeOrder: 2,
          title: 'Episode 2',
          script: 'Naskah 2...',
          summary: 'Summary 2',
        },
      ],
    };

    const result = buildSeriesContextPrompt(ctx);
    expect(result).toContain('episode 3');
    expect(result).toContain('Episode 1');
    expect(result).toContain('Episode 2');
    expect(result).toContain('Summary 1');
    expect(result).toContain('Summary 2');
  });

  it('should use script excerpt when summary is empty', () => {
    const longScript = 'Ini adalah naskah yang sangat panjang dan akan dipotong menjadi ringkasan singkat untuk konteks episode sebelumnya.';
    const ctx: SeriesContext = {
      seriesId: 'series-001',
      episodeOrder: 2,
      previousEpisodes: [
        {
          episodeOrder: 1,
          title: 'Episode 1',
          script: longScript,
          summary: '',
        },
      ],
    };

    const result = buildSeriesContextPrompt(ctx);
    expect(result).toContain('Ini adalah naskah');
    expect(result).toContain('...');
  });
});

describe('script-generator — series context in generateScript', () => {
  it('should include series context in user prompt when provided', async () => {
    const generateSpy = vi.fn();
    const provider: AIProvider = {
      name: 'mock-spy',
      version: '1.0.0',
      generate: async (prompt: string, options: AIProviderOptions) => {
        generateSpy(prompt, options);
        return {
          content: mockScriptResponse,
          finishReason: 'stop' as const,
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          model: 'mock-model',
          provider: 'mock-spy',
          latency: 50,
        };
      },
      generateStream: async function* () { yield ''; },
      isAvailable: async () => true,
      getModels: async () => ['mock-model'],
    };

    const input: ScriptGeneratorInput = {
      character: mockCharacter,
      storyIdea: 'Suro melanjutkan petualangan',
      targetDuration: 15,
      contentRating: 'ALL_AGES',
      seriesContext: {
        seriesId: 'series-001',
        episodeOrder: 2,
        previousEpisodes: [
          {
            episodeOrder: 1,
            title: 'Suro dan Harta Karun',
            script: 'Naskah episode 1...',
            summary: 'Suro menemukan harta karun',
          },
        ],
      },
    };

    await generateScript(input, provider);

    const [prompt] = generateSpy.mock.calls[0];
    expect(prompt).toContain('episode 2');
    expect(prompt).toContain('Episode 1');
    expect(prompt).toContain('Suro dan Harta Karun');
    expect(prompt).toContain('continuity');
  });
});