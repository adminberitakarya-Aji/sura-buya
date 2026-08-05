/**
 * VF-5.5 — Studio Review Reject API Route
 *
 * POST /api/universes/[universeId]/studio/[projectId]/review/reject
 *   Send rejection signal to review workflow.
 *   Project status remains at RENDERED — user needs to regenerate/fix issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: Promise<{ universeId: string; projectId: string }>;
}

const rejectSchema = z.object({
  feedback: z.string().optional(),
});

/** POST — Reject review */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { feedback } = rejectSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists
    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      select: { universeId: true, status: true },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Send rejection signal to review workflow
    const workflowId = `review-${projectId}`;

    try {
      const { sendReviewApproval } = await import('@suro-buya/video-worker/client');
      await sendReviewApproval(workflowId, 'REJECT', feedback);
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to send rejection signal: ${(error as Error).message}` },
        { status: 500 },
      );
    }

    // 3. Project status remains at RENDERED — user needs to fix issues
    // Note: We don't change status back to STORYBOARDED because the
    // storyboard is still valid — user just needs to regenerate script/visuals

    return NextResponse.json({
      message: 'Review rejected — please fix the issues and resubmit for review',
      decision: 'REJECT' as const,
    });
  } catch (error) {
    return errorResponse(error);
  }
}