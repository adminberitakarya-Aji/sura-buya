import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { blocksToText, type SceneBlock } from '@/lib/engine/scene-output';
import { snapshotSceneVersion } from '@/lib/scene-versions';

const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('heading'), text: z.string() }),
  z.object({ id: z.string(), type: z.literal('action'), text: z.string() }),
  z.object({
    id: z.string(),
    type: z.literal('dialogue'),
    character: z.string(),
    line: z.string(),
    parenthetical: z.string().optional(),
  }),
  z.object({ id: z.string(), type: z.literal('transition'), text: z.string() }),
]);

const updateBlocksSchema = z.object({
  blocks: z.array(blockSchema).min(1),
});

interface RouteParams {
  params: { universeId: string; episodeId: string; sceneId: string };
}

/**
 * PATCH /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId/blocks
 *
 * Saves block-based edits from the Scene Editor. `generatedText` is always
 * regenerated from the blocks so downstream consumers (canon validator,
 * review diff) keep working off a single source of truth.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const existing = await prisma.scene.findFirst({
      where: {
        id: params.sceneId,
        episodeId: params.episodeId,
        episode: { universeId: params.universeId },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const body = await req.json();
    const { blocks } = updateBlocksSchema.parse(body);

    const generatedText = blocksToText(blocks as SceneBlock[]);
    const textChanged = generatedText !== existing.generatedText;

    const scene = await prisma.scene.update({
      where: { id: existing.id },
      data: {
        blocks: blocks as unknown as any,
        generatedText,
        ...(textChanged ? { version: { increment: 1 } } : {}),
      },
    });

    if (textChanged) {
      await snapshotSceneVersion(scene.id, scene.version, generatedText);
    }

    return NextResponse.json({ scene });
  } catch (error) {
    return errorResponse(error);
  }
}
