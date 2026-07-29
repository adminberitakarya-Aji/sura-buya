import { describe, it, expect, vi, beforeEach } from 'vitest';

const universeFindUniqueOrThrowMock = vi.fn();
const characterFindManyMock = vi.fn();
const regionFindManyMock = vi.fn();
const bibleFileFindFirstMock = vi.fn();
const episodeFindUniqueOrThrowMock = vi.fn();
const sceneFindManyMock = vi.fn();
const sceneFindUniqueOrThrowMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    universe: { findUniqueOrThrow: (...a: unknown[]) => universeFindUniqueOrThrowMock(...a) },
    character: { findMany: (...a: unknown[]) => characterFindManyMock(...a) },
    region: { findMany: (...a: unknown[]) => regionFindManyMock(...a) },
    bibleFile: { findFirst: (...a: unknown[]) => bibleFileFindFirstMock(...a) },
    episode: { findUniqueOrThrow: (...a: unknown[]) => episodeFindUniqueOrThrowMock(...a) },
    scene: {
      findMany: (...a: unknown[]) => sceneFindManyMock(...a),
      findUniqueOrThrow: (...a: unknown[]) => sceneFindUniqueOrThrowMock(...a),
    },
  },
}));

import {
  buildUniverseConfig,
  buildCharacterBibles,
  buildWorldBibles,
  buildStoryProfile,
  buildEpisodeStructure,
  buildSceneGenerationInput,
} from './db-context';

const now = new Date('2026-01-01T00:00:00.000Z');

beforeEach(() => {
  universeFindUniqueOrThrowMock.mockReset();
  characterFindManyMock.mockReset();
  regionFindManyMock.mockReset();
  bibleFileFindFirstMock.mockReset();
  episodeFindUniqueOrThrowMock.mockReset();
  sceneFindManyMock.mockReset();
  sceneFindUniqueOrThrowMock.mockReset();
});

describe('buildUniverseConfig', () => {
  it('maps universe fields and defaults locale to "id" when manifest is empty', async () => {
    universeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'uni-1',
      name: 'Suro & Buya',
      version: 2,
      slug: 'suro-buya',
      description: 'Petualangan di Surabaya',
      manifest: {},
    });

    const config = await buildUniverseConfig('uni-1');
    expect(config.id).toBe('uni-1');
    expect(config.name).toBe('Suro & Buya');
    expect(config.locale).toBe('id');
    expect(config.locales).toEqual(['id']);
  });

  it('uses manifest.defaultLanguage when present', async () => {
    universeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'uni-1',
      name: 'Suro & Buya',
      version: 1,
      slug: 'suro-buya',
      description: null,
      manifest: { defaultLanguage: 'jv' },
    });

    const config = await buildUniverseConfig('uni-1');
    expect(config.locale).toBe('jv');
  });
});

describe('buildCharacterBibles', () => {
  it('keys the result by characterId and maps role to archetype', async () => {
    characterFindManyMock.mockResolvedValue([
      {
        characterId: 'suro',
        name: 'Suro',
        displayName: 'Suro',
        description: 'Hiu muda pemberani',
        role: 'PROTAGONIST',
        coreTraits: ['berani', 'setia'],
        coreWeakness: 'terlalu impulsif',
        voiceGuide: 'Bicara cepat dan penuh semangat.',
        createdAt: now,
        updatedAt: now,
      },
      {
        characterId: 'antagonis-1',
        name: 'Hiu Jahat',
        displayName: 'Hiu Jahat',
        description: null,
        role: 'ANTAGONIST',
        coreTraits: [],
        coreWeakness: 'sombong',
        voiceGuide: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const bibles = await buildCharacterBibles('uni-1');
    expect(Object.keys(bibles)).toEqual(['suro', 'antagonis-1']);
    expect(bibles.suro.archetype).toBe('protagonist');
    expect(bibles.suro.traits).toEqual(['berani', 'setia']);
    expect(bibles['antagonis-1'].archetype).toBe('antagonist');
    expect(bibles['antagonis-1'].voice).toBeUndefined();
  });
});

describe('buildWorldBibles', () => {
  it('keys the result by regionId', async () => {
    regionFindManyMock.mockResolvedValue([
      {
        regionId: 'jatim',
        name: 'Jawa Timur',
        description: 'Kampung pesisir',
        geography: 'pesisir, perbukitan',
        cultureGuide: 'ramah, gotong royong',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const worlds = await buildWorldBibles('uni-1');
    expect(worlds.jatim.name).toBe('Jawa Timur');
    expect(worlds.jatim.geography?.terrain).toEqual(['pesisir, perbukitan']);
    expect(worlds.jatim.culture?.customs).toEqual(['ramah, gotong royong']);
  });
});

describe('buildStoryProfile', () => {
  it('falls back to universe description when no STORY bible file exists', async () => {
    universeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'uni-1',
      name: 'Suro & Buya',
      description: 'Kisah dua sahabat di Surabaya',
      manifest: {},
      createdAt: now,
      updatedAt: now,
    });
    bibleFileFindFirstMock.mockResolvedValue(null);
    characterFindManyMock.mockResolvedValue([{ characterId: 'suro' }, { characterId: 'buya' }]);
    regionFindManyMock.mockResolvedValue([{ regionId: 'jatim' }]);

    const story = await buildStoryProfile('uni-1');
    expect(story.synopsis).toBe('Kisah dua sahabat di Surabaya');
    expect(story.characters).toEqual(['suro', 'buya']);
    expect(story.locations).toEqual(['jatim']);
  });

  it('prefers the STORY bible file content as synopsis when available', async () => {
    universeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'uni-1',
      name: 'Suro & Buya',
      description: 'fallback',
      manifest: { themes: ['persahabatan'], genre: ['petualangan'] },
      createdAt: now,
      updatedAt: now,
    });
    bibleFileFindFirstMock.mockResolvedValue({ content: 'Sinopsis lengkap dari story bible.' });
    characterFindManyMock.mockResolvedValue([]);
    regionFindManyMock.mockResolvedValue([]);

    const story = await buildStoryProfile('uni-1');
    expect(story.synopsis).toBe('Sinopsis lengkap dari story bible.');
    expect(story.themes).toEqual(['persahabatan']);
    expect(story.genre).toEqual(['petualangan']);
  });
});

describe('buildEpisodeStructure', () => {
  it('infers scene type by position (exposition/climax/resolution)', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      episodeNumber: 1,
      premise: 'Suro menemukan peta harta karun.',
      title: 'Peta Misterius',
      targetScenes: 4,
      season: { seasonNumber: 1 },
      scenes: [
        { sceneNumber: 1, region: 'pantai', characters: ['suro'], premise: 'Pembuka' },
        { sceneNumber: 2, region: 'hutan', characters: ['suro', 'buya'], premise: 'Tengah' },
        { sceneNumber: 3, region: 'gua', characters: ['suro'], premise: 'Klimaks' },
        { sceneNumber: 4, region: 'pantai', characters: ['suro', 'buya'], premise: 'Penutup' },
      ],
      createdAt: now,
      updatedAt: now,
    });

    const structure = await buildEpisodeStructure('ep-1');
    expect(structure.scenes[0].type).toBe('exposition');
    expect(structure.scenes[3].type).toBe('resolution');
    expect(structure.season).toBe(1);
  });
});

describe('buildSceneGenerationInput', () => {
  it('uses the previous scene summary as continuity context', async () => {
    sceneFindUniqueOrThrowMock.mockResolvedValue({
      id: 'scene-2',
      sceneNumber: 2,
      region: 'hutan',
      characters: ['suro', 'buya'],
      premise: 'Mereka menyusuri hutan.',
      episodeId: 'ep-1',
    });
    episodeFindUniqueOrThrowMock.mockResolvedValue({ id: 'ep-1', targetScenes: 4 });
    sceneFindManyMock.mockResolvedValue([
      {
        id: 'scene-1',
        sceneNumber: 1,
        region: 'pantai',
        characters: ['suro'],
        premise: 'Suro menemukan peta.',
        episodeId: 'ep-1',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const input = await buildSceneGenerationInput('uni-1', 'ep-1', 'scene-2');
    expect(input.sceneNumber).toBe(2);
    expect(input.previousSceneSummary).toBe('Suro menemukan peta.');
    expect(input.keyBeats).toEqual(['Mereka menyusuri hutan.']);
  });

  it('has no previous scene summary for the first scene', async () => {
    sceneFindUniqueOrThrowMock.mockResolvedValue({
      id: 'scene-1',
      sceneNumber: 1,
      region: 'pantai',
      characters: ['suro'],
      premise: 'Pembuka cerita.',
      episodeId: 'ep-1',
    });
    episodeFindUniqueOrThrowMock.mockResolvedValue({ id: 'ep-1', targetScenes: 4 });
    sceneFindManyMock.mockResolvedValue([]);

    const input = await buildSceneGenerationInput('uni-1', 'ep-1', 'scene-1');
    expect(input.previousSceneSummary).toBeUndefined();
    expect(input.type).toBe('exposition');
  });
});
