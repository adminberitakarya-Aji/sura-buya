import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { runJob } from '@/lib/jobs';
import { buildProviderRegistryForUniverse, UnconfiguredProviderError, buildOrchestratorAndRegistryForUniverse } from '@/lib/engine/orchestrator';
import { SeasonPlanner, createDefaultSeasonPlanner } from '@suro-buya/engine-v2/plan/season-planner.js';
import { EpisodePlanner, createDefaultEpisodePlanner } from '@suro-buya/engine-v2/plan/episode-planner.js';
import { buildGenerationContext } from '@/lib/engine/db-context';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for season planning (multiple episodes)

interface RouteParams {
  params: { universeId: string; seasonId: string };
}

const generatePlanSchema = z.object({
  episodeCount: z.number().int().positive().max(50).optional(),
  targetRuntimeMinutes: z.number().int().positive().max(120).optional(),
  arcType: z.enum(['serialized', 'episodic', 'anthology', 'hybrid']).optional(),
  themes: z.array(z.string()).optional(),
  focusCharacters: z.array(z.string()).optional(),
  tone: z.string().optional(),
});

async function assertSeasonInUniverse(universeId: string, seasonId: string) {
  return prisma.season.findFirstOrThrow({
    where: { id: seasonId, universeId },
    select: { id: true, seasonNumber: true },
  });
}

/**
 * POST /api/universes/:universeId/seasons/:seasonId/plan
 *
 * Generates a full season plan (episodes, character arcs, themes, act structure)
 * via AI (multiple chained LLM calls — season structure + per-episode plans)
 * and persists it to Season.plan.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');
    const season = await assertSeasonInUniverse(params.universeId, params.seasonId);

    // Fail fast if no AI provider is configured yet.
    try {
      await buildProviderRegistryForUniverse(params.universeId);
    } catch (error) {
      if (error instanceof UnconfiguredProviderError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const body = await req.json();
    const options = generatePlanSchema.parse(body);

    const { job, result, error } = await runJob(
      {
        universeId: params.universeId,
        userId,
        type: 'SEASON_PLANNING',
        input: { seasonId: params.seasonId, options },
      },
      async (report: (progress: number, step?: string) => Promise<void>) => {
        await report(5, 'Mempersiapkan planner season');

        // Build dependencies (same as CLI generate:season)
        const { orchestrator, registry } = await buildOrchestratorAndRegistryForUniverse(params.universeId);

        const episodePlanner = createDefaultEpisodePlanner(orchestrator, registry);
        const seasonPlanner = createDefaultSeasonPlanner(episodePlanner, orchestrator, registry);

        await report(10, 'Menyusun struktur season');

        // Get generation context for the universe (season-level doesn't need episode-specific context)
        // Use a dummy episodeId since the season planner only needs universe-level data
        const context = await buildGenerationContext(params.universeId, 'season-planner-dummy');

        // Generate season plan
        const seasonPlan = await seasonPlanner.generateSeasonPlan(
          params.universeId,
          season.seasonNumber,
          context,
          {
            episodeCount: options.episodeCount ?? 10,
            targetRuntimeMinutes: options.targetRuntimeMinutes ?? 22,
            arcType: options.arcType ?? 'serialized',
            themes: options.themes ?? [],
            focusCharacters: options.focusCharacters ?? [],
            tone: options.tone ?? 'dramedy',
          }
        );

        await report(90, 'Menyimpan rencana season');
        await prisma.season.update({
          where: { id: season.id },
          data: { plan: seasonPlan as unknown as any },
        });

        return { plan: seasonPlan };
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

/**
 * GET /api/universes/:universeId/seasons/:seasonId/plan
 *
 * Retrieves the stored season plan from Season.plan
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');
    await assertSeasonInUniverse(params.universeId, params.seasonId);

    const season = await prisma.season.findFirstOrThrow({
      where: { id: params.seasonId, universeId: params.universeId },
      select: { plan: true },
    });

    return NextResponse.json({ plan: season.plan });
  } catch (error) {
    return errorResponse(error);
  }
}
