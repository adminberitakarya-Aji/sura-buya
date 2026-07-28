import { createDefaultEpisodePlanner } from '@suro-buya/engine-v2/plan/episode-planner.js';
import type { EpisodePlannerInput, EpisodePlan } from '@suro-buya/engine-v2/plan/episode-planner.js';
import { prisma } from '@/lib/prisma';
import { buildGenerationContext, buildStoryProfile } from './db-context';
import { buildOrchestratorAndRegistryForUniverse } from './orchestrator';

/** Build the EpisodePlannerInput for an episode directly from Postgres. */
export async function buildEpisodePlannerInput(
  universeId: string,
  episodeId: string
): Promise<EpisodePlannerInput> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
    include: { season: true },
  });

  const [storyProfile, previousEpisode] = await Promise.all([
    buildStoryProfile(universeId),
    prisma.episode.findFirst({
      where: { seasonId: episode.seasonId, episodeNumber: { lt: episode.episodeNumber } },
      orderBy: { episodeNumber: 'desc' },
    }),
  ]);

  return {
    universeId,
    seasonNumber: episode.season.seasonNumber,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    premise: episode.premise,
    storyArc: '',
    focusCharacters: storyProfile.characters,
    keyPlotPoints: [],
    themes: storyProfile.themes,
    targetRuntime: 22,
    sceneCount: episode.targetScenes,
    previousEpisodeSummary: previousEpisode?.premise,
  };
}

/**
 * Generate a full episode plan (beats, acts, scenes, character arcs) via AI
 * for the given episode, using this universe's configured providers.
 */
export async function planEpisode(universeId: string, episodeId: string): Promise<EpisodePlan> {
  const [input, context, { orchestrator, registry }] = await Promise.all([
    buildEpisodePlannerInput(universeId, episodeId),
    buildGenerationContext(universeId, episodeId),
    buildOrchestratorAndRegistryForUniverse(universeId),
  ]);

  const planner = createDefaultEpisodePlanner(orchestrator, registry);
  return planner.generateEpisodePlan(input, context);
}
