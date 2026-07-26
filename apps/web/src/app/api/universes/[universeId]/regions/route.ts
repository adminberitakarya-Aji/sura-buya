import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createRegionSchema = z.object({
  regionId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'regionId must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  cultureGuide: z.string().max(8000).optional(),
  geography: z.string().max(8000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/regions */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const regions = await prisma.region.findMany({
      where: { universeId: params.universeId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ regions });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/regions */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const { metadata, ...rest } = createRegionSchema.parse(body);

    const region = await prisma.region.create({
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
        universeId: params.universeId,
      },
    });

    return NextResponse.json({ region }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
