import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const updateBibleFileSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(200_000).optional(),
  frontmatter: z.record(z.unknown()).nullable().optional(),
});

interface RouteParams {
  params: { universeId: string; bibleFileId: string };
}

/** GET /api/universes/:universeId/bible/:bibleFileId — full content incl. body. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const bibleFile = await prisma.bibleFile.findFirstOrThrow({
      where: { id: params.bibleFileId, universeId: params.universeId },
    });

    return NextResponse.json({ bibleFile });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/universes/:universeId/bible/:bibleFileId
 * Bumps `version` by 1 whenever content or frontmatter changes.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const existing = await prisma.bibleFile.findFirstOrThrow({
      where: { id: params.bibleFileId, universeId: params.universeId },
      select: { id: true },
    });

    const body = await req.json();
    const data = updateBibleFileSchema.parse(body);
    const { frontmatter, ...restData } = data;
    const contentChanged = restData.content !== undefined || frontmatter !== undefined;

    const bibleFile = await prisma.bibleFile.update({
      where: { id: existing.id },
      data: {
        ...restData,
        ...(frontmatter !== undefined
          ? {
              frontmatter:
                frontmatter === null
                  ? Prisma.JsonNull
                  : (frontmatter as Prisma.InputJsonValue),
            }
          : {}),
        updatedById: userId,
        ...(contentChanged ? { version: { increment: 1 } } : {}),
      },
    });

    return NextResponse.json({ bibleFile });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/bible/:bibleFileId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const existing = await prisma.bibleFile.findFirstOrThrow({
      where: { id: params.bibleFileId, universeId: params.universeId },
      select: { id: true },
    });

    await prisma.bibleFile.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
