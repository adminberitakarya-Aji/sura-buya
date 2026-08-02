import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const updateComparisonSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  winnerId: z.string().optional().nullable(),
});

interface RouteParams {
  params: { universeId: string; sessionId: string };
}

/**
 * GET /api/universes/:universeId/comparisons/:sessionId
 * Get a single comparison session with all results
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  try {
    await assertCan(userId, params.universeId, 'content:read');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await prisma.comparisonSession.findFirst({
    where: {
      id: params.sessionId,
      universeId: params.universeId,
    },
    include: {
      results: {
        orderBy: { rank: 'asc' },
      },
      winner: {
        select: {
          id: true,
          modelId: true,
          modelName: true,
          provider: true,
          output: true,
          scores: true,
          rank: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Comparison session not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...session,
    config: session.config as Record<string, unknown>,
    promptVariants: session.promptVariants as Record<string, string>,
  });
}

/**
 * PATCH /api/universes/:universeId/comparisons/:sessionId
 * Update a comparison session (name, status, winner)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  try {
    await assertCan(userId, params.universeId, 'content:write');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof updateComparisonSchema>;
  try {
    const raw = await req.json();
    body = updateComparisonSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const session = await prisma.comparisonSession.findFirst({
    where: { id: params.sessionId, universeId: params.universeId },
  });

  if (!session) {
    return NextResponse.json({ error: 'Comparison session not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.winnerId !== undefined) updateData.winnerId = body.winnerId;
  if (body.status === 'COMPLETED' && !session.completedAt) {
    updateData.completedAt = new Date();
  }

  const updated = await prisma.comparisonSession.update({
    where: { id: params.sessionId },
    data: updateData,
    include: {
      results: { orderBy: { rank: 'asc' } },
      winner: { select: { id: true, modelId: true, modelName: true, provider: true, output: true, scores: true, rank: true } },
    },
  });

  return NextResponse.json({
    ...updated,
    config: updated.config as Record<string, unknown>,
    promptVariants: updated.promptVariants as Record<string, string>,
  });
}

/**
 * DELETE /api/universes/:universeId/comparisons/:sessionId
 * Delete a comparison session and its results
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  try {
    await assertCan(userId, params.universeId, 'content:write');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await prisma.comparisonSession.findFirst({
    where: { id: params.sessionId, universeId: params.universeId },
  });

  if (!session) {
    return NextResponse.json({ error: 'Comparison session not found' }, { status: 404 });
  }

  await prisma.comparisonSession.delete({ where: { id: params.sessionId } });

  return NextResponse.json({ success: true });
}