import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: { universeId: string; episodeId: string };
}

interface PlanScene {
  number: number;
  location?: string;
  characters?: string[];
  summary?: string;
}

/**
 * POST /api/universes/:universeId/episodes/:episodeId/scenes/from-plan
 *
 * Bulk-creates Scene rows from `Episode.plan.scenes` (produced by the AI
 * episode planner). Skips scene numbers that already have a Scene row, so
 * it's safe to call again after adding new beats.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const episode = await prisma.episode.findFirst({
      where: { id: params.episodeId, universeId: params.universeId },
      include: { scenes: { select: { sceneNumber: true } } },
    });

    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const plan = episode.plan as { scenes?: PlanScene[] } | null;
    const planScenes = plan?.scenes ?? [];

    if (planScenes.length === 0) {
      return NextResponse.json(
        { error: 'Episode ini belum punya rencana scene. Jalankan AI planner dulu.' },
        { status: 400 }
      );
    }

    const existingNumbers = new Set(episode.scenes.map((s: { sceneNumber: number }) => s.sceneNumber));
    const toCreate = planScenes.filter((s) => !existingNumbers.has(s.number));

    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0, scenes: [] });
    }

    const scenes = await prisma.$transaction(
      toCreate.map((s) =>
        prisma.scene.create({
          data: {
            episodeId: episode.id,
            sceneNumber: s.number,
            premise: s.summary || `Scene ${s.number}`,
            characters: s.characters ?? [],
            region: s.location,
          },
        })
      )
    );

    return NextResponse.json({ created: scenes.length, scenes });
  } catch (error) {
    return errorResponse(error);
  }
}
