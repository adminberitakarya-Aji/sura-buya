import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { snapshotSceneVersion } from '@/lib/scene-versions';

const SCENE_STATUSES = ['DRAFT', 'GENERATED', 'VALIDATED', 'APPROVED', 'REJECTED'] as const;

const updateSceneSchema = z.object({
  premise: z.string().min(1).max(4000).optional(),
  characters: z.array(z.string()).optional(),
  region: z.string().max(200).nullable().optional(),
  generatedText: z.string().nullable().optional(),
  status: z.enum(SCENE_STATUSES).optional(),
  validationReport: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  /** When the editable text changes, bump the version counter (default true). */
  bumpVersion: z.boolean().optional(),
});

interface RouteParams {
  params: { universeId: string; episodeId: string; sceneId: string };
}

async function findScopedScene(universeId: string, episodeId: string, sceneId: string) {
  return prisma.scene.findFirstOrThrow({
    where: { id: sceneId, episodeId, episode: { universeId } },
  });
}

/** GET /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const scene = await findScopedScene(params.universeId, params.episodeId, params.sceneId);

    return NextResponse.json({ scene });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const existing = await findScopedScene(params.universeId, params.episodeId, params.sceneId);

    const body = await req.json();
    const { validationReport, metadata, bumpVersion, generatedText, ...restData } =
      updateSceneSchema.parse(body);

    const shouldBumpVersion =
      generatedText !== undefined && generatedText !== existing.generatedText
        ? bumpVersion !== false
        : false;

    const scene = await prisma.scene.update({
      where: { id: existing.id },
      data: {
        ...restData,
        ...(generatedText !== undefined ? { generatedText } : {}),
        ...(shouldBumpVersion ? { version: { increment: 1 } } : {}),
        ...(validationReport !== undefined
          ? {
              validationReport:
                validationReport === null
                  ? Prisma.JsonNull
                  : (validationReport as Prisma.InputJsonValue),
            }
          : {}),
        ...(metadata !== undefined
          ? { metadata: metadata === null ? Prisma.JsonNull : (metadata as Prisma.InputJsonValue) }
          : {}),
      },
    });

    if (shouldBumpVersion && generatedText) {
      await snapshotSceneVersion(scene.id, scene.version, generatedText);
    }

    return NextResponse.json({ scene });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const existing = await findScopedScene(params.universeId, params.episodeId, params.sceneId);

    await prisma.scene.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
