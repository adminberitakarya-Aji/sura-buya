import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createUniverseSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  manifest: z.record(z.unknown()).default({}),
  isPublic: z.boolean().default(false),
});

/** GET /api/universes — list universes the current user is a member of. */
export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const universes = await prisma.universe.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { characters: true, episodes: true, regions: true } },
        members: { where: { userId }, select: { role: true } },
      },
    });

    return NextResponse.json({
      universes: universes.map((u: (typeof universes)[number]) => ({
        id: u.id,
        slug: u.slug,
        name: u.name,
        description: u.description,
        version: u.version,
        isPublic: u.isPublic,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        role: u.members[0]?.role,
        counts: u._count,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes — create a new universe. Creator becomes OWNER. */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const body = await req.json();
    const data = createUniverseSchema.parse(body);

    const universe = await prisma.universe.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        manifest: data.manifest as any,
        isPublic: data.isPublic,
        ownerId: userId,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    });

    return NextResponse.json({ universe }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
