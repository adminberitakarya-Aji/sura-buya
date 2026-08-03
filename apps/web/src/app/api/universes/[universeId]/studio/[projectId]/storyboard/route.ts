/**
 * VF-2.6 — Storyboard Generation API Route
 *
 * POST /api/universes/[universeId]/studio/[projectId]/storyboard
 *
 * Calls engine-v2 breakDownScript() (VF-2.5) to convert the project's
 * script into a ShotSpec[] storyboard. Also runs prompt-builder (VF-2.5)
 * to generate visual/motion/negative prompts per shot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import {
  breakDownScript,
  buildAllPrompts,
  type SceneBreakdownInput,
} from '@suro-buya/engine-v2';
import { generateBeatSheet } from '@suro-buya/engine-v2';
import type { VideoCharacterContext, ContentRating } from '@suro-buya/shared';

interface RouteParams {
  params: { universeId: string; projectId: string };
}

/**
 * Build VideoCharacterContext from Prisma Character + CharacterAsset.
 * Same bridge pattern as script route.
 */
async function buildVideoCharacterContext(
  prisma: any,
  characterId: string,
  universeId: string,
): Promise<VideoCharacterContext> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      characterAsset: true,
    },
  });

  if (!character || character.universeId !== universeId) {
    throw new Error('Character not found in this universe');
  }

  const metadata = (character.metadata ?? {}) as Record<string, unknown>;
  return {
    id: character.id,
    characterId: character.characterId,
    displayName: character.displayName,
    role: character.role,
    description: character.description ?? '',
    coreTraits: character.coreTraits,
    coreWeakness: character.coreWeakness,
    voiceGuide: character.voiceGuide ?? '',
    metadata: {
      species: typeof metadata.species === 'string' ? metadata.species : '',
      ageDescriptor: typeof metadata.ageDescriptor === 'string' ? metadata.ageDescriptor : '',
      motivation: typeof metadata.motivation === 'string' ? metadata.motivation : null,
      visualDescription: typeof metadata.visualDescription === 'string' ? metadata.visualDescription : '',
      personaSource: metadata.personaSource === 'manual' ? 'manual' : 'ai-parsed',
    },
    visualProfile: character.characterAsset
      ? {
          referenceImages: character.characterAsset.referenceImages,
          styleTags: [],
        }
      : undefined,
  };
}

/** POST /api/universes/:universeId/studio/:projectId/storyboard */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const { prisma } = await import('@/lib/prisma');

    // Get project with script
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.script || project.script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script is empty. Generate a script first.' },
        { status: 400 },
      );
    }

    // Build VideoCharacterContext (bridge layer)
    const character = await buildVideoCharacterContext(
      prisma,
      project.characterId,
      params.universeId,
    );

    // Get target duration from project settings
    const settings = (project.settings ?? {}) as Record<string, unknown>;
    const targetDuration = (settings.targetDuration as 15 | 30 | 60) ?? 15;

    // Generate beat sheet
    const beatSheet = generateBeatSheet(targetDuration);

    // Break down script into shots
    const breakdownInput: SceneBreakdownInput = {
      script: project.script,
      beatSheet,
      character,
    };

    const breakdownResult = breakDownScript(breakdownInput);

    // Build prompts for each shot
    const shotsWithPrompts = breakdownResult.shots.map((shot) => {
      const prompts = buildAllPrompts({
        shot,
        visualProfile: character.visualProfile,
      });
      return {
        ...shot,
        visualPrompt: prompts.visualPrompt,
        motionPrompt: prompts.motionPrompt,
        negativePrompt: prompts.negativePrompt,
      };
    });

    // Save storyboard to project
    const updatedProject = await prisma.videoProject.update({
      where: { id: params.projectId },
      data: {
        storyboard: shotsWithPrompts as any,
        status: 'STORYBOARDED',
      },
    });

    return NextResponse.json({
      project: updatedProject,
      shots: shotsWithPrompts,
      totalShots: shotsWithPrompts.length,
      totalDuration: breakdownResult.totalDuration,
      beatsCovered: breakdownResult.beatsCovered,
      warnings: breakdownResult.warnings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}