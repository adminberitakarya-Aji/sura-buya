import type { ValidationContext, SceneData } from '@suro-buya/engine-v2';
import { prisma } from '@/lib/prisma';
import {
  buildUniverseConfig,
  buildCharacterBibles,
  buildWorldBibles,
  buildStoryProfile,
  buildEpisodeStructure,
} from './db-context';

/**
 * The engine's built-in default rules (see `createDefaultRuleEngine`) read
 * generated text off `sceneData.content`, a field that only exists on the
 * canon validator's internal `ExtendedSceneData` type. We attach it here too
 * so both the built-in rules and our own DB-defined rules can see the text.
 */
export interface SceneDataWithContent extends SceneData {
  content: string;
}

/** Build the ValidationContext for validating a specific scene's generated text. */
export async function buildValidationContext(
  universeId: string,
  episodeId: string,
  sceneId: string
): Promise<ValidationContext> {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });

  const [universeConfig, characterBibles, worldBibles, storyProfile, episodeStructure] =
    await Promise.all([
      buildUniverseConfig(universeId),
      buildCharacterBibles(universeId),
      buildWorldBibles(universeId),
      buildStoryProfile(universeId),
      buildEpisodeStructure(episodeId),
    ]);

  const content = scene.generatedText ?? '';

  const sceneData: SceneDataWithContent = {
    id: scene.id,
    createdAt: scene.createdAt.toISOString(),
    updatedAt: scene.updatedAt.toISOString(),
    version: scene.version,
    number: scene.sceneNumber,
    episodeId: scene.episodeId,
    location: scene.region ?? 'unknown',
    timeOfDay: 'day',
    characters: scene.characters,
    type: 'dialogue',
    beats: [{ order: 1, description: scene.premise }],
    estimatedDuration: 5,
    content,
  };

  return {
    content,
    contentType: 'scene',
    universeConfig,
    characterBibles,
    worldBibles,
    storyProfile,
    episodeStructure,
    sceneData,
  };
}
