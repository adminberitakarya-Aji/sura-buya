/**
 * VF-5.5 — Studio Review Approve API Route
 *
 * POST /api/universes/[universeId]/studio/[projectId]/review/approve
 *   Send approval signal to review workflow.
 *   Update project status to REVIEWED after approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: Promise<{ universeId: string; projectId: string }>;
}

const approveSchema = z.object({
  feedback: z.string().optional(),
});

/** POST — Approve review */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { feedback } = approveSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists
    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      select: { universeId: true, status: true },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Send approval signal to review workflow
    const workflowId = `review-${projectId}`;

    try {
      const { sendReviewApproval } = await import('@suro-buya/video-worker/client');
      await sendReviewApproval(workflowId, 'APPROVE', feedback);
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to send approval signal: ${(error as Error).message}` },
        { status: 500 },
      );
    }

    // 3. Update project status to REVIEWED
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'REVIEWED' },
    });

    return NextResponse.json({
      message: 'Review approved — video is ready for export',
      decision: 'APPROVE' as const,
    });
  } catch (error) {
    return errorResponse(error);
  }
}