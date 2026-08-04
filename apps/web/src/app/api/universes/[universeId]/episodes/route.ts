import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createEpisodeSchema = z.object({
  seasonId: z.string().min(1),
  episodeNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  premise: z.string().min(1).max(8000),
  targetScenes: z.number().int().positive().max(50).default(6),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/episodes?seasonId=... */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const seasonId = req.nextUrl.searchParams.get('seasonId') ?? undefined;

    const episodes = await prisma.episode.findMany({
      where: { universeId: params.universeId, ...(seasonId ? { seasonId } : {}) },
      orderBy: [{ seasonId: 'asc' }, { episodeNumber: 'asc' }],
      include: {
        season: { select: { id: true, seasonNumber: true, title: true } },
        _count: { select: { scenes: true } },
      },
    });

    return NextResponse.json({ episodes });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/episodes */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createEpisodeSchema.parse(body);

    // Ensure the season belongs to this universe before attaching an episode to it.
    await prisma.season.findFirstOrThrow({
      where: { id: data.seasonId, universeId: params.universeId },
      select: { id: true },
    });

    const episode = await prisma.episode.create({
      data: {
        ...data,
        universeId: params.universeId,
      } satisfies any,
    });

    return NextResponse.json({ episode }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
