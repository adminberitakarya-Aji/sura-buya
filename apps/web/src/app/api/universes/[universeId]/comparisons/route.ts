import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized } from '@/lib/api-helpers';
import { buildOrchestratorAndRegistryForUniverse, UnconfiguredProviderError } from '@/lib/engine/orchestrator';
import { ComparisonOrchestrator } from '@suro-buya/engine-v2';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Validation schemas
const createComparisonSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(1).max(10000),
  systemPrompt: z.string().max(5000).optional(),
  models: z.array(z.object({
    modelId: z.string(),
    modelName: z.string(),
    provider: z.string(),
    parameters: z.object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().max(8000).optional(),
      topP: z.number().min(0).max(1).optional(),
      topK: z.number().int().positive().optional(),
    }).optional(),
  })).min(2).max(4),
  context: z.object({
    universeId: z.string(),
    episodeId: z.string().optional(),
    sceneNumber: z.number().int().positive().optional(),
    bibleContext: z.string().optional(),
    canonRules: z.array(z.string()).optional(),
    characterVoices: z.record(z.string()).optional(),
  }).optional(),
  taskType: z.enum(['creative-generation', 'planning', 'validation', 'embedding']).default('creative-generation'),
  options: z.object({
    parallel: z.boolean().optional(),
    timeoutMs: z.number().int().positive().max(300000).optional(),
    judgeModelId: z.string().optional(),
    scoringWeights: z.object({
      canon: z.number().min(0).max(1).optional(),
      quality: z.number().min(0).max(1).optional(),
      creativity: z.number().min(0).max(1).optional(),
      instruction: z.number().min(0).max(1).optional(),
    }).optional(),
  }).optional(),
});

const listComparisonsSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  createdBy: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

interface RouteParams {
  params: { universeId: string };
}

/**
 * GET /api/universes/:universeId/comparisons
 * List comparison sessions with filters and pagination
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  try {
    await assertCan(userId, params.universeId, 'content:read');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = listComparisonsSchema.safeParse(Object.fromEntries(url.searchParams));
  
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const { status, createdBy, dateFrom, dateTo, limit, offset } = parsed.data;

  const where: Record<string, unknown> = { universeId: params.universeId };
  if (status) where.status = status;
  if (createdBy) where.createdBy = createdBy;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
  }

  const [sessions, total] = await Promise.all([
    prisma.comparisonSession.findMany({
      where,
      include: {
        results: {
          select: {
            id: true,
            modelId: true,
            modelName: true,
            provider: true,
            tokensUsed: true,
            latencyMs: true,
            costEstimate: true,
            scores: true,
            rank: true,
            error: true,
          },
        },
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.comparisonSession.count({ where }),
  ]);

  return NextResponse.json({
    sessions: sessions.map(s => ({
      ...s,
      config: s.config as Record<string, unknown>,
      promptVariants: s.promptVariants as Record<string, string>,
      resultCount: s._count.results,
    })),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  });
}

/**
 * POST /api/universes/:universeId/comparisons
 * Create and run a new comparison session
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  try {
    await assertCan(userId, params.universeId, 'content:write');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof createComparisonSchema>;
  try {
    const raw = await req.json();
    body = createComparisonSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Verify universe exists
  const universe = await prisma.universe.findUnique({ where: { id: params.universeId } });
  if (!universe) {
    return NextResponse.json({ error: 'Universe not found' }, { status: 404 });
  }

  // Fail fast if no AI provider configured
  let orchestrator: ComparisonOrchestrator;
  try {
    const { registry: providerRegistry } = await buildOrchestratorAndRegistryForUniverse(params.universeId);
    orchestrator = new ComparisonOrchestrator(providerRegistry);
  } catch (error) {
    if (error instanceof UnconfiguredProviderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Create session record
  const sessionId = randomUUID();
  const session = await prisma.comparisonSession.create({
    data: {
      id: sessionId,
      universeId: params.universeId,
      name: body.name,
      prompt: body.prompt,
      promptVariants: {},
      status: 'PENDING',
      config: body as unknown as import('@prisma/client/runtime/library').JsonObject,
      createdBy: userId,
    },
  });

  // Run comparison in background (async)
  // Note: In production, this would be a background job
  runComparisonAsync(sessionId, body, orchestrator).catch(console.error);

  return NextResponse.json({ session }, { status: 201 });
}

async function runComparisonAsync(
  sessionId: string,
  body: z.infer<typeof createComparisonSchema>,
  orchestrator: ComparisonOrchestrator
) {
  try {
    // Update status to RUNNING
    await prisma.comparisonSession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING' },
    });

    const config = {
      models: body.models.map(m => ({
        modelId: m.modelId,
        modelName: m.modelName,
        provider: m.provider,
        parameters: m.parameters ?? {},
      })),
      taskType: body.taskType,
      systemPrompt: body.systemPrompt,
      prompt: body.prompt,
      context: body.context,
    };

    const options = {
      parallel: body.options?.parallel ?? true,
      timeoutMs: body.options?.timeoutMs ?? 120000,
      judgeModelId: body.options?.judgeModelId,
      scoringWeights: body.options?.scoringWeights,
    };

    const results = await orchestrator.runComparison(config, options);

    // Update session with results
    await prisma.$transaction(async (tx) => {
      // Create result records
      const createdResults = await Promise.all(results.map((result, index) =>
        tx.comparisonResult.create({
          data: {
            sessionId,
            modelId: result.modelId,
            modelName: result.modelName,
            provider: result.provider,
            output: result.output,
            tokensUsed: result.tokensUsed.total,
            latencyMs: result.latencyMs,
            costEstimate: result.costEstimate,
            scores: result.scores as unknown as Prisma.JsonObject,
            rank: result.rank,
          },
        })
      ));

      // Determine winner (highest ranked successful result)
      const winnerResult = results.find(r => r.rank === 1 && !r.error);
      const winnerRecord = winnerResult ? createdResults.find(cr => cr.modelId === winnerResult.modelId) : null;
      
      // Update session status
      await tx.comparisonSession.update({
        where: { id: sessionId },
        data: {
          status: winnerResult ? 'COMPLETED' : 'FAILED',
          winnerId: winnerRecord?.id,
          completedAt: new Date(),
        },
      });
    });
  } catch (error) {
    console.error('Comparison failed:', error);
    await prisma.comparisonSession.update({
      where: { id: sessionId },
      data: { status: 'FAILED', completedAt: new Date() },
    });
  }
}