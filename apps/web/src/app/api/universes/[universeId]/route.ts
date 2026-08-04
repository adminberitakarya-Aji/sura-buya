import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const updateUniverseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  manifest: z.record(z.unknown()).optional(),
  version: z.string().optional(),
  isPublic: z.boolean().optional(),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'universe:read');

    const universe = await prisma.universe.findUniqueOrThrow({
      where: { id: params.universeId },
      include: {
        _count: { select: { characters: true, episodes: true, regions: true } },
        members: {
          select: { userId: true, role: true, user: { select: { name: true, email: true, image: true } } },
        },
      },
    });

    return NextResponse.json({ universe });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'universe:update');

    const body = await req.json();
    const data = updateUniverseSchema.parse(body);
    const { manifest, ...restData } = data;

    const universe = await prisma.universe.update({
      where: { id: params.universeId },
      data: {
        ...restData,
        ...(manifest !== undefined
          ? { manifest: manifest as any }
          : {}),
      },
    });

    return NextResponse.json({ universe });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'universe:delete');

    await prisma.universe.delete({ where: { id: params.universeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
