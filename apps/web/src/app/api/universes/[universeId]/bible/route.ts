import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const bibleCategoryEnum = z.enum([
  'CHARACTER',
  'WORLD',
  'STORY',
  'VISUAL',
  'PRODUCTION',
]);

const createBibleFileSchema = z.object({
  category: bibleCategoryEnum,
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9/-]+\.md$/, 'path must be a lowercase .md path, e.g. "voice-protagonist.md"'),
  title: z.string().min(1).max(200),
  content: z.string().max(200_000),
  frontmatter: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/bible?category=CHARACTER */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const category = req.nextUrl.searchParams.get('category');
    const parsedCategory = category
      ? bibleCategoryEnum.safeParse(category)
      : undefined;

    const bibleFiles = await prisma.bibleFile.findMany({
      where: {
        universeId: params.universeId,
        ...(parsedCategory?.success ? { category: parsedCategory.data } : {}),
      },
      orderBy: [{ category: 'asc' }, { path: 'asc' }],
      // Omit `content` in list view to keep the payload light; fetch full
      // content via the single-file GET endpoint.
      select: {
        id: true,
        category: true,
        path: true,
        title: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ bibleFiles });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/bible */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createBibleFileSchema.parse(body);

    const bibleFile = await prisma.bibleFile.create({
      data: {
        ...data,
        frontmatter: data.frontmatter as any | undefined,
        universeId: params.universeId,
        createdById: userId,
        updatedById: userId,
      },
    });

    return NextResponse.json({ bibleFile }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
