/**
 * VF-5.5 — Studio Review Logs API Route
 *
 * GET /api/universes/[universeId]/studio/[projectId]/review/logs
 *   Get SafetyReviewLog audit trail — semua log entries untuk project ini.
 *   Berguna untuk menampilkan history keputusan moderation sebelumnya.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: Promise<{ universeId: string; projectId: string }>;
}

/** GET — Get SafetyReviewLog audit trail */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists
    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      select: { universeId: true },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Get all SafetyReviewLog entries for this project
    const logs = await prisma.safetyReviewLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        projectId: log.projectId,
        universeId: log.universeId,
        reviewerId: log.reviewerId,
        status: log.status,
        layer: log.layer,
        flaggedRule: log.flaggedRule,
        category: log.category,
        severity: log.severity,
        message: log.message,
        location: log.location,
        suggestion: log.suggestion,
        confidence: log.confidence,
        contentRating: log.contentRating,
        videoMetadata: log.videoMetadata,
        feedback: log.feedback,
        decidedAt: log.decidedAt,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        reviewer: log.reviewer
          ? {
              id: log.reviewer.id,
              name: log.reviewer.name,
              email: log.reviewer.email,
            }
          : null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}