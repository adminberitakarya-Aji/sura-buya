import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const updateSeasonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  theme: z.string().max(2000).nullable().optional(),
  arcSummary: z.string().max(4000).nullable().optional(),
  episodeCount: z.number().int().positive().max(100).optional(),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
  plan: z.record(z.unknown()).nullable().optional(),
});

interface RouteParams {
  params: { universeId: string; seasonId: string };
}

/** GET /api/universes/:universeId/seasons/:seasonId */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const season = await prisma.season.findFirstOrThrow({
      where: { id: params.seasonId, universeId: params.universeId },
      include: { episodes: { orderBy: { episodeNumber: 'asc' } } },
    });

    return NextResponse.json({ season });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/seasons/:seasonId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const existing = await prisma.season.findFirstOrThrow({
      where: { id: params.seasonId, universeId: params.universeId },
      select: { id: true },
    });

    const body = await req.json();
    const { plan, ...restData } = updateSeasonSchema.parse(body);

    const season = await prisma.season.update({
      where: { id: existing.id },
      data: {
        ...restData,
        ...(plan !== undefined
          ? { plan: plan === null ? null as any : (plan as any) }
          : {}),
      },
    });

    return NextResponse.json({ season });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/seasons/:seasonId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const existing = await prisma.season.findFirstOrThrow({
      where: { id: params.seasonId, universeId: params.universeId },
      select: { id: true },
    });

    await prisma.season.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
