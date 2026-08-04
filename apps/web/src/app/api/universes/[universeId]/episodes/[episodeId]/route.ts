import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const EPISODE_STATUSES = [
  'PLANNING',
  'GENERATING',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
] as const;

const updateEpisodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  premise: z.string().min(1).max(8000).optional(),
  status: z.enum(EPISODE_STATUSES).optional(),
  targetScenes: z.number().int().positive().max(50).optional(),
  plan: z.record(z.unknown()).nullable().optional(),
});

interface RouteParams {
  params: { universeId: string; episodeId: string };
}

/** GET /api/universes/:universeId/episodes/:episodeId */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const episode = await prisma.episode.findFirstOrThrow({
      where: { id: params.episodeId, universeId: params.universeId },
      include: {
        season: { select: { id: true, seasonNumber: true, title: true } },
        scenes: { orderBy: { sceneNumber: 'asc' } },
      },
    });

    return NextResponse.json({ episode });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/episodes/:episodeId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const existing = await prisma.episode.findFirstOrThrow({
      where: { id: params.episodeId, universeId: params.universeId },
      select: { id: true },
    });

    const body = await req.json();
    const { plan, ...restData } = updateEpisodeSchema.parse(body);

    const episode = await prisma.episode.update({
      where: { id: existing.id },
      data: {
        ...restData,
        ...(plan !== undefined
          ? { plan: plan === null ? null as any : (plan as any) }
          : {}),
      },
    });

    return NextResponse.json({ episode });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/episodes/:episodeId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const existing = await prisma.episode.findFirstOrThrow({
      where: { id: params.episodeId, universeId: params.universeId },
      select: { id: true },
    });

    await prisma.episode.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
