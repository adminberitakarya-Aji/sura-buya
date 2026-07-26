import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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

const updateCharacterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: characterRoleEnum.optional(),
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  coreTraits: z.array(z.string()).optional(),
  coreWeakness: z.string().min(1).max(500).optional(),
  voiceGuide: z.string().max(8000).nullable().optional(),
  bibleRef: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  order: z.number().int().optional(),
});

interface RouteParams {
  params: { universeId: string; characterId: string };
}

/** GET /api/universes/:universeId/characters/:characterId (by DB id) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const character = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
    });

    return NextResponse.json({ character });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/characters/:characterId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    // Scope the update to this universe to prevent cross-universe writes.
    const existing = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
      select: { id: true },
    });

    const body = await req.json();
    const data = updateCharacterSchema.parse(body);
    const { metadata, ...restData } = data;

    const character = await prisma.character.update({
      where: { id: existing.id },
      data: {
        ...restData,
        ...(metadata !== undefined
          ? {
              metadata:
                metadata === null
                  ? Prisma.JsonNull
                  : (metadata as Prisma.InputJsonValue),
            }
          : {}),
      },
    });

    return NextResponse.json({ character });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/characters/:characterId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const existing = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
      select: { id: true },
    });

    await prisma.character.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
