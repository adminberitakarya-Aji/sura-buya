import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: { universeId: string; episodeId: string; sceneId: string };
}

/** GET /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId/versions */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const scene = await prisma.scene.findFirst({
      where: {
        id: params.sceneId,
        episodeId: params.episodeId,
        episode: { universeId: params.universeId },
      },
      select: { id: true },
    });

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const versions = await prisma.sceneVersion.findMany({
      where: { sceneId: scene.id },
      orderBy: { version: 'asc' },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    return errorResponse(error);
  }
}
