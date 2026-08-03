/**
 * VF-2.6 — Series Detail API Routes
 *
 * GET    /api/universes/[universeId]/series/[seriesId] — get series with projects
 * PATCH  /api/universes/[universeId]/series/[seriesId] — update series
 * DELETE /api/universes/[universeId]/series/[seriesId] — delete series
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const updateSeriesSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  characterIds: z.array(z.string()).min(1).optional(),
});

interface RouteParams {
  params: { universeId: string; seriesId: string };
}

/** GET /api/universes/:universeId/series/:seriesId */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');
    const series = await prisma.videoSeries.findUnique({
      where: { id: params.seriesId },
      include: {
        videoProjects: {
          orderBy: { episodeOrder: 'asc' },
          select: {
            id: true,
            title: true,
            episodeOrder: true,
            status: true,
            characterId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!series || series.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    return NextResponse.json({ series });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/series/:seriesId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = updateSeriesSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // Verify series exists in this universe
    const existing = await prisma.videoSeries.findUnique({
      where: { id: params.seriesId },
      select: { universeId: true },
    });

    if (!existing || existing.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // Verify characters if updating
    if (data.characterIds) {
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
    }

    const series = await prisma.videoSeries.update({
      where: { id: params.seriesId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.characterIds && { characterIds: data.characterIds }),
      },
    });

    return NextResponse.json({ series });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/series/:seriesId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const { prisma } = await import('@/lib/prisma');

    // Verify series exists in this universe
    const existing = await prisma.videoSeries.findUnique({
      where: { id: params.seriesId },
      select: { universeId: true },
    });

    if (!existing || existing.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    await prisma.videoSeries.delete({
      where: { id: params.seriesId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}