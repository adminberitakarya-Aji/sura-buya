import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { runJob } from '@/lib/jobs';
import { planEpisode } from '@/lib/engine/episode-planner';
import { buildProviderRegistryForUniverse, UnconfiguredProviderError } from '@/lib/engine/orchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

interface RouteParams {
  params: { universeId: string; episodeId: string };
}

async function assertEpisodeInUniverse(universeId: string, episodeId: string) {
  return prisma.episode.findFirstOrThrow({
    where: { id: episodeId, universeId },
    select: { id: true },
  });
}

/**
 * POST /api/universes/:universeId/episodes/:episodeId/plan
 *
 * Generates a full beat/act/scene plan via AI (several chained LLM calls —
 * structure, beats, character arcs, B-story — so this runs as a bounded
 * background job rather than a token stream) and persists it to
 * Episode.plan.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');
    await assertEpisodeInUniverse(params.universeId, params.episodeId);

    // Fail fast (plain JSON, not a job) if no AI provider is configured yet.
    try {
      await buildProviderRegistryForUniverse(params.universeId);
    } catch (error) {
      if (error instanceof UnconfiguredProviderError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const { job, result, error } = await runJob(
      {
        universeId: params.universeId,
        userId,
        type: 'EPISODE_PLANNING',
        input: { episodeId: params.episodeId },
      },
      async (report) => {
        await report(10, 'Menyusun struktur episode');
        const plan = await planEpisode(params.universeId, params.episodeId);

        await report(90, 'Menyimpan rencana episode');
        await prisma.episode.update({
          where: { id: params.episodeId },
          data: { plan: plan as unknown as any },
        });

        return { plan };
      }
    );

    if (error) {
      return NextResponse.json({ error, job }, { status: 502 });
    }

    return NextResponse.json({ job, plan: result?.plan });
  } catch (error) {
    return errorResponse(error);
  }
}

const beatSchema = z.object({
  id: z.string(),
  type: z.string(),
  order: z.number(),
  description: z.string(),
  characters: z.array(z.string()),
  location: z.string().optional(),
  estimatedDuration: z.number(),
  act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  dependencies: z.array(z.string()),
  emotionalArc: z.string(),
  stakes: z.string(),
});

const updatePlanSchema = z.object({
  beats: z.array(beatSchema),
});

/**
 * PATCH /api/universes/:universeId/episodes/:episodeId/plan
 *
 * Saves manually-edited beats (reordering from the drag-drop beat board,
 * or inline edits) without calling AI again. Merges into the existing plan
 * JSON so acts/scenes/characterArcs/etc from the last AI generation are
 * preserved; only `beats` is overwritten.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const episode = await prisma.episode.findFirst({
      where: { id: params.episodeId, universeId: params.universeId },
    });
    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const body = await req.json();
    const { beats } = updatePlanSchema.parse(body);

    const existingPlan = (episode.plan as Record<string, unknown> | null) ?? {};
    const updatedPlan = { ...existingPlan, beats };

    const updated = await prisma.episode.update({
      where: { id: episode.id },
      data: { plan: updatedPlan as unknown as any },
    });

    return NextResponse.json({ plan: updated.plan });
  } catch (error) {
    return errorResponse(error);
  }
}
