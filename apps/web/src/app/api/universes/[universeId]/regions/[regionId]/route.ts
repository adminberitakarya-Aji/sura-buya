import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const updateRegionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  cultureGuide: z.string().max(8000).nullable().optional(),
  geography: z.string().max(8000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

interface RouteParams {
  params: { universeId: string; regionId: string };
}

/** GET /api/universes/:universeId/regions/:regionId (by DB id) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const region = await prisma.region.findFirstOrThrow({
      where: { id: params.regionId, universeId: params.universeId },
    });

    return NextResponse.json({ region });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/regions/:regionId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    // Scope the update to this universe to prevent cross-universe writes.
    const existing = await prisma.region.findFirstOrThrow({
      where: { id: params.regionId, universeId: params.universeId },
      select: { id: true },
    });

    const body = await req.json();
    const { metadata, ...restData } = updateRegionSchema.parse(body);

    const region = await prisma.region.update({
      where: { id: existing.id },
      data: {
        ...restData,
        ...(metadata !== undefined
          ? {
              metadata:
                metadata === null ? Prisma.JsonNull : (metadata as Prisma.InputJsonValue),
            }
          : {}),
      },
    });

    return NextResponse.json({ region });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/regions/:regionId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const existing = await prisma.region.findFirstOrThrow({
      where: { id: params.regionId, universeId: params.universeId },
      select: { id: true },
    });

    await prisma.region.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
