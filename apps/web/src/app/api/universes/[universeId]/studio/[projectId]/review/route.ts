/**
 * VF-5.5 — Studio Review API Routes
 *
 * POST /api/universes/[universeId]/studio/[projectId]/review
 *   Start review workflow via Temporal:
 *   1. Verify project exists and has script + storyboard
 *   2. Build ReviewWorkflowInput from project data + universe contentRating
 *   3. Start reviewWorkflow (canon check → safety review → human approval)
 *   4. Return workflow ID for client-side polling
 *
 * GET /api/universes/[universeId]/studio/[projectId]/review
 *   Get review status — query workflow status + review result.
 *   Returns canon + safety findings untuk ditampilkan di UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: Promise<{ universeId: string; projectId: string }>;
}

/** POST — Start review workflow via Temporal */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:write');

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists and has script + storyboard
    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      include: {
        character: {
          include: {
            characterAsset: true,
          },
        },
        series: true,
        universe: {
          select: {
            contentRating: true,
            audienceProfile: true,
          },
        },
      },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.script || project.script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script is required before review — generate script first' },
        { status: 400 },
      );
    }

    // 2. Build shot descriptions + visual prompts from storyboard
    const storyboard = Array.isArray(project.storyboard) ? project.storyboard : [];
    const shotDescriptions = storyboard.map((shot: any) => shot.action || shot.description || '');
    const visualPrompts = storyboard.map((shot: any) => shot.visualPrompt || '');

    // 3. Build ReviewWorkflowInput
    const reviewInput = {
      projectId,
      universeId,
      reviewerId: userId,
      script: project.script,
      shotDescriptions: shotDescriptions.length > 0 ? shotDescriptions : undefined,
      visualPrompts: visualPrompts.length > 0 ? visualPrompts : undefined,
      characterId: project.characterId,
      contentRating: project.universe.contentRating,
      audienceProfile: project.universe.audienceProfile ?? undefined,
      seriesId: project.seriesId ?? undefined,
      episodeOrder: project.episodeOrder ?? undefined,
      title: project.title,
    };

    // 4. Start review workflow via Temporal
    const { startReviewWorkflow } = await import('@suro-buya/video-worker/client');

    const workflowHandle = await startReviewWorkflow(reviewInput);

    // 5. Update project status to indicate review in progress
    // Note: We don't change to REVIEWED yet — that happens after approval
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'RENDERED' }, // Keep at RENDERED until review completes
    });

    return NextResponse.json({
      message: 'Review workflow started',
      workflowId: workflowHandle.workflowId,
      projectId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET — Get review status (workflow status + review result) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');

    // 1. Get project info
    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      select: {
        universeId: true,
        status: true,
        title: true,
      },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Check if there's a review workflow running
    // Workflow ID pattern: review-{projectId}
    const workflowId = `review-${projectId}`;

    let workflowStatus: string | null = null;
    let reviewResult: any = null;

    try {
      const { getReviewWorkflowStatus, getReviewWorkflowResult } = await import('@suro-buya/video-worker/client');

      // Query workflow status
      workflowStatus = await getReviewWorkflowStatus(workflowId);

      // Query review result (available after canon + safety checks complete)
      reviewResult = await getReviewWorkflowResult(workflowId);
    } catch {
      // Workflow might not exist yet (not started) or Temporal not running
      // Return empty state — no review in progress
    }

    // 3. Check for existing SafetyReviewLog entries (from previous reviews)
    const existingLogs = await prisma.safetyReviewLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const hasReview = workflowStatus !== null || existingLogs.length > 0;

    return NextResponse.json({
      projectStatus: project.status,
      title: project.title,
      workflowId: workflowStatus !== null ? workflowId : null,
      workflowStatus,
      reviewResult,
      hasReview,
    });
  } catch (error) {
    return errorResponse(error);
  }
}