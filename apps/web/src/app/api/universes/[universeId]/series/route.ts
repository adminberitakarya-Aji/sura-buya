/**
 * VF-2.6 — Series API Routes
 *
 * GET  /api/universes/[universeId]/series — list all VideoSeries
 * POST /api/universes/[universeId]/series — create new VideoSeries
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createSeriesSchema = z.object({
  title: z.string().min(1).max(200),
  characterIds: z.array(z.string()).min(1),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/series */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');
    const series = await prisma.videoSeries.findMany({
      where: { universeId: params.universeId },
      include: {
        _count: {
          select: { videoProjects: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ series });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/series */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createSeriesSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // Verify characters exist in this universe
    const characters = await prisma.character.findMany({
      where: {
        id: { in: data.characterIds },
        universeId: params.universeId,
      },
      select: { id: true },
    });

    if (characters.length !== data.characterIds.length) {
      return NextResponse.json(
        { error: 'One or more characters not found in this universe' },
        { status: 400 },
      );
    }

    const series = await prisma.videoSeries.create({
      data: {
        universeId: params.universeId,
        title: data.title,
        characterIds: data.characterIds,
      },
    });

    return NextResponse.json({ series }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}