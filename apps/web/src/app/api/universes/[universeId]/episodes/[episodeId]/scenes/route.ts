import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  premise: z.string().min(1).max(4000),
  characters: z.array(z.string()).default([]),
  region: z.string().max(200).optional(),
});

interface RouteParams {
  params: { universeId: string; episodeId: string };
}

async function assertEpisodeInUniverse(universeId: string, episodeId: string) {
  return prisma.episode.findFirstOrThrow({
    where: { id: episodeId, universeId },
    select: { id: true },
  });
}

/** GET /api/universes/:universeId/episodes/:episodeId/scenes */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');
    await assertEpisodeInUniverse(params.universeId, params.episodeId);

    const scenes = await prisma.scene.findMany({
      where: { episodeId: params.episodeId },
      orderBy: { sceneNumber: 'asc' },
    });

    return NextResponse.json({ scenes });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/episodes/:episodeId/scenes */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');
    await assertEpisodeInUniverse(params.universeId, params.episodeId);

    const body = await req.json();
    const data = createSceneSchema.parse(body);

    const scene = await prisma.scene.create({
      data: {
        ...data,
        episodeId: params.episodeId,
      } satisfies any,
    });

    return NextResponse.json({ scene }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
