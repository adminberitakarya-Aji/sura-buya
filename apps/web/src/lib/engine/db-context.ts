import type {
  GenerationContext,
  UniverseConfig,
  CharacterProfile,
  WorldProfile,
  StoryProfile,
  EpisodeStructure,
  SceneData,
  SceneGenerationInput,
} from '@suro-buya/engine-v2';
import type { CharacterArchetype } from '@suro-buya/shared';
import { prisma } from '@/lib/prisma';

/**
 * DB Context Builder
 * ===================
 * engine-v2's `ContextBuilder`/`BibleLoader` read universe bible content from
 * the filesystem (`universe-bible/**\/*.md`). This dashboard stores that same
 * content in Postgres instead (`Character`, `Region`, `BibleFile` tables), so
 * we can't reuse `BibleLoader` directly.
 *
 * This module is the bridge: it reads the same universe from Postgres and
 * assembles the in-memory `GenerationContext` shape the orchestrator expects,
 * so `GenerationOrchestrator` / `CanonValidator` work unmodified against
 * dashboard-managed universes.
 */

const ROLE_TO_ARCHETYPE: Record<string, CharacterArchetype> = {
  PROTAGONIST: 'protagonist',
  DEUTERAGONIST: 'sidekick',
  SUPPORTING: 'sidekick',
  ANTAGONIST: 'antagonist',
  NARRATOR: 'mentor',
};

/** Scene types cycle through a simple dramatic shape when we don't know better. */
function inferSceneType(
  sceneNumber: number,
  targetScenes: number
): EpisodeStructure['scenes'][number]['type'] {
  if (sceneNumber <= 1) return 'exposition';
  if (sceneNumber >= targetScenes) return 'resolution';
  if (sceneNumber === Math.ceil(targetScenes / 2)) return 'climax';
  return 'dialogue';
}

export async function buildUniverseConfig(universeId: string): Promise<UniverseConfig> {
  const universe = await prisma.universe.findUniqueOrThrow({ where: { id: universeId } });
  const manifest = (universe.manifest as Record<string, unknown>) ?? {};
  const locale = typeof manifest.defaultLanguage === 'string' ? manifest.defaultLanguage : 'id';

  return {
    id: universe.id,
    name: universe.name,
    version: universe.version,
    locale,
    locales: [locale],
    timezone: 'Asia/Jakarta',
    metadata: { slug: universe.slug, description: universe.description ?? undefined },
  };
}

export async function buildCharacterBibles(
  universeId: string
): Promise<Record<string, CharacterProfile>> {
  const characters = await prisma.character.findMany({ where: { universeId } });
  const result: Record<string, CharacterProfile> = {};

  for (const c of characters) {
    result[c.characterId] = {
      id: c.characterId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      version: 1,
      name: c.displayName || c.name,
      archetype: ROLE_TO_ARCHETYPE[c.role] ?? 'sidekick',
      description: c.description ?? c.name,
      traits: c.coreTraits,
      voice: c.voiceGuide
        ? { tone: c.voiceGuide.slice(0, 300), vocabulary: [], speechPatterns: [] }
        : undefined,
      weaknesses: [c.coreWeakness],
    };
  }

  return result;
}

export async function buildWorldBibles(universeId: string): Promise<Record<string, WorldProfile>> {
  const regions = await prisma.region.findMany({ where: { universeId } });
  const result: Record<string, WorldProfile> = {};

  for (const r of regions) {
    result[r.regionId] = {
      id: r.regionId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      version: 1,
      name: r.name,
      type: 'region',
      description: r.description ?? r.name,
      geography: r.geography ? { climate: '', terrain: [r.geography], landmarks: [] } : undefined,
      culture: r.cultureGuide
        ? { language: [], customs: [r.cultureGuide], beliefs: [], socialStructure: '' }
        : undefined,
    };
  }

  return result;
}

/**
 * There's no dedicated "Story" table — the story bible lives as markdown
 * `BibleFile` rows (category STORY). We synthesize a `StoryProfile` from the
 * universe manifest plus the first story bible file's content as synopsis.
 */
export async function buildStoryProfile(universeId: string): Promise<StoryProfile> {
  const universe = await prisma.universe.findUniqueOrThrow({ where: { id: universeId } });
  const manifest = (universe.manifest as Record<string, unknown>) ?? {};

  const storyBible = await prisma.bibleFile.findFirst({
    where: { universeId, category: 'STORY' },
    orderBy: { updatedAt: 'desc' },
  });

  const characters = await prisma.character.findMany({
    where: { universeId },
    select: { characterId: true },
  });
  const regions = await prisma.region.findMany({
    where: { universeId },
    select: { regionId: true },
  });

  return {
    id: universe.id,
    createdAt: universe.createdAt.toISOString(),
    updatedAt: universe.updatedAt.toISOString(),
    version: 1,
    title: universe.name,
    type: 'series',
    logline: universe.description ?? universe.name,
    synopsis: storyBible?.content.slice(0, 2000) ?? universe.description ?? universe.name,
    themes: Array.isArray(manifest.themes) ? (manifest.themes as string[]) : [],
    genre: Array.isArray(manifest.genre) ? (manifest.genre as string[]) : ['petualangan', 'edukasi'],
    audience: typeof manifest.audience === 'string' ? manifest.audience : 'anak-anak 4-9 tahun',
    tone: typeof manifest.tone === 'string' ? manifest.tone : 'hangat, ceria, edukatif',
    characters: characters.map((c: { characterId: string }) => c.characterId),
    locations: regions.map((r: { regionId: string }) => r.regionId),
    plotPoints: [],
  };
}

export async function buildEpisodeStructure(episodeId: string): Promise<EpisodeStructure> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
    include: { season: true, scenes: { orderBy: { sceneNumber: 'asc' } } },
  });

  return {
    id: episode.id,
    createdAt: episode.createdAt.toISOString(),
    updatedAt: episode.updatedAt.toISOString(),
    version: 1,
    number: episode.episodeNumber,
    season: episode.season.seasonNumber,
    title: episode.title,
    summary: episode.premise,
    scenes: episode.scenes.map(
      (s: { sceneNumber: number; region: string | null; characters: string[]; premise: string }) => ({
        number: s.sceneNumber,
        location: s.region ?? 'unknown',
        characters: s.characters,
        summary: s.premise,
        type: inferSceneType(s.sceneNumber, episode.targetScenes),
        estimatedDuration: 5,
      })
    ),
    themes: [],
    characterArcs: [],
  };
}

async function buildPreviousScenes(episodeId: string, beforeSceneNumber: number): Promise<SceneData[]> {
  const scenes = await prisma.scene.findMany({
    where: { episodeId, sceneNumber: { lt: beforeSceneNumber } },
    orderBy: { sceneNumber: 'asc' },
  });

  return scenes.map(
    (s: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      version: number;
      sceneNumber: number;
      episodeId: string;
      region: string | null;
      characters: string[];
      premise: string;
    }) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      version: s.version,
      number: s.sceneNumber,
      episodeId: s.episodeId,
      location: s.region ?? 'unknown',
      timeOfDay: 'day',
      characters: s.characters,
      type: 'dialogue' as const,
      beats: [{ order: 1, description: s.premise }],
      estimatedDuration: 5,
    })
  );
}

/**
 * Assemble the full GenerationContext for a scene/episode generation call,
 * scoped to one universe + episode.
 */
export async function buildGenerationContext(
  universeId: string,
  episodeId: string,
  beforeSceneNumber?: number
): Promise<GenerationContext> {
  const [universeConfig, characterBibles, worldBibles, storyProfile, episodeStructure, previousScenes] =
    await Promise.all([
      buildUniverseConfig(universeId),
      buildCharacterBibles(universeId),
      buildWorldBibles(universeId),
      buildStoryProfile(universeId),
      buildEpisodeStructure(episodeId),
      beforeSceneNumber !== undefined
        ? buildPreviousScenes(episodeId, beforeSceneNumber)
        : Promise.resolve([]),
    ]);

  return {
    universeConfig,
    characterBibles,
    worldBibles,
    storyProfile,
    episodeStructure,
    previousScenes,
    characterStates: {},
    worldState: {},
  };
}

/** Build the SceneGenerationInput for a specific (already-created) Scene row. */
export async function buildSceneGenerationInput(
  universeId: string,
  episodeId: string,
  sceneId: string
): Promise<SceneGenerationInput> {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } });
  const previousScenes = await buildPreviousScenes(episodeId, scene.sceneNumber);
  const previous = previousScenes[previousScenes.length - 1];

  return {
    universeId,
    episodeId,
    sceneNumber: scene.sceneNumber,
    location: scene.region ?? 'unknown',
    timeOfDay: 'day',
    characters: scene.characters,
    type: inferSceneType(scene.sceneNumber, episode.targetScenes),
    estimatedDuration: 5,
    keyBeats: [scene.premise],
    previousSceneSummary: previous?.beats[0]?.description,
  };
}
