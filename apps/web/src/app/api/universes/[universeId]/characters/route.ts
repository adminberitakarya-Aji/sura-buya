import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const characterRoleEnum = z.enum([
  'PROTAGONIST',
  'DEUTERAGONIST',
  'SUPPORTING',
  'ANTAGONIST',
  'NARRATOR',
]);

const createCharacterSchema = z.object({
  characterId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'characterId must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  role: characterRoleEnum,
  displayName: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  coreTraits: z.array(z.string()).default([]),
  coreWeakness: z.string().min(1).max(500),
  voiceGuide: z.string().max(8000).optional(),
  bibleRef: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  order: z.number().int().default(0),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/characters */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const characters = await prisma.character.findMany({
      where: { universeId: params.universeId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/characters */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createCharacterSchema.parse(body);

    const character = await prisma.character.create({
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
        universeId: params.universeId,
      },
    });

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
