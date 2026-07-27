import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createSeasonSchema = z.object({
  seasonNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  theme: z.string().max(2000).optional(),
  arcSummary: z.string().max(4000).optional(),
  episodeCount: z.number().int().positive().max(100).default(10),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/seasons */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const seasons = await prisma.season.findMany({
      where: { universeId: params.universeId },
      orderBy: { seasonNumber: 'asc' },
      include: { _count: { select: { episodes: true } } },
    });

    return NextResponse.json({ seasons });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/seasons */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createSeasonSchema.parse(body);

    const season = await prisma.season.create({
      data: {
        ...data,
        universeId: params.universeId,
      } satisfies Prisma.SeasonUncheckedCreateInput,
    });

    return NextResponse.json({ season }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
