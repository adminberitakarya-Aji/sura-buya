/**
 * VF-2.6 — Studio API Routes (VideoProject list + create)
 *
 * GET  /api/universes/[universeId]/studio — list all VideoProject
 * POST /api/universes/[universeId]/studio — create new VideoProject
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const createProjectSchema = z.object({
  characterId: z.string().min(1),
  seriesId: z.string().optional(),
  episodeOrder: z.number().int().positive().optional(),
  title: z.string().min(1).max(200),
  targetDuration: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(15),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/studio */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');
    const projects = await prisma.videoProject.findMany({
      where: { universeId: params.universeId },
      include: {
        character: {
          select: { id: true, displayName: true, characterId: true },
        },
        series: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/studio */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createProjectSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // Verify character exists in this universe
    const character = await prisma.character.findFirst({
      where: {
        id: data.characterId,
        universeId: params.universeId,
      },
      select: { id: true },
    });

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found in this universe' },
        { status: 400 },
      );
    }

    // Verify series if provided
    if (data.seriesId) {
      const series = await prisma.videoSeries.findFirst({
        where: {
          id: data.seriesId,
          universeId: params.universeId,
        },
        select: { id: true },
      });

      if (!series) {
        return NextResponse.json(
          { error: 'Series not found in this universe' },
          { status: 400 },
        );
      }
    }

    // Check unique constraint for (seriesId, episodeOrder) if both provided
    if (data.seriesId && data.episodeOrder) {
      const existing = await prisma.videoProject.findUnique({
        where: {
          seriesId_episodeOrder: {
            seriesId: data.seriesId,
            episodeOrder: data.episodeOrder,
          },
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Episode ${data.episodeOrder} already exists in this series` },
          { status: 409 },
        );
      }
    }

    const project = await prisma.videoProject.create({
      data: {
        universeId: params.universeId,
        characterId: data.characterId,
        seriesId: data.seriesId ?? null,
        episodeOrder: data.episodeOrder ?? null,
        title: data.title,
        script: '',
        storyboard: [],
        status: 'DRAFT',
        settings: { targetDuration: data.targetDuration },
      },
      include: {
        character: {
          select: { id: true, displayName: true, characterId: true },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}