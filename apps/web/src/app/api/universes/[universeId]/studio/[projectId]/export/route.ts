/**
 * VF-4.7 — Studio Export API Routes
 *
 * POST /api/universes/[universeId]/studio/[projectId]/export
 *   Start full video render workflow via Temporal:
 *   1. Create VideoRender record with PENDING status
 *   2. Start renderWorkflow (build timeline → Remotion render → FFmpeg encode)
 *   3. Return workflow ID for client-side polling
 *
 * GET /api/universes/[universeId]/studio/[projectId]/export
 *   Get export status — list semua VideoRender untuk project ini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: Promise<{ universeId: string; projectId: string }>;
}

const exportSchema = z.object({
  /** Platform target untuk export — array untuk multi-platform */
  platforms: z.array(z.enum(['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS'])).default(['TIKTOK']),
});

const retrySchema = z.object({
  renderId: z.string().cuid(),
});

/** POST — Start full video render workflow via Temporal */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { platforms } = exportSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists and has media assets
    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      include: {
        character: {
          include: {
            characterAsset: true,
          },
        },
        mediaAssets: true,
      },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Check that all media assets are DONE
    const allDone = project.mediaAssets.length > 0 &&
      project.mediaAssets.every((a: { status: string }) => a.status === 'DONE');

    if (!allDone) {
      return NextResponse.json(
        { error: 'Not all media assets are done — complete generation first' },
        { status: 400 },
      );
    }

    // 3. Build timeline to get total duration and dimensions
    const storyboard = project.storyboard as Array<{ duration?: number }>;
    const videoClips = project.mediaAssets.filter((a: { type: string }) => a.type === 'VIDEO_CLIP');
    const audioAssets = project.mediaAssets.filter((a: { type: string }) => a.type === 'AUDIO');

    const totalDuration = storyboard.reduce((sum: number, shot: { duration?: number }) => sum + (shot.duration ?? 0), 0);

    // 4. Create VideoRender record with PENDING status for each platform (VF-4.6)
    const renders = await Promise.all(
      platforms.map(async (platform: string) => {
        return prisma.videoRender.create({
          data: {
            projectId,
            videoUrl: '', // Will be filled when render completes
            thumbnailUrl: '',
            duration: totalDuration,
            width: 1080,
            height: 1920,
            resolution: '1080x1920',
            platform: [platform as 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS'],
            codec: 'h264',
            status: 'PENDING',
            metadata: {
              timeline: {
                totalShots: storyboard.length,
                videoClips: videoClips.length,
                audioAssets: audioAssets.length,
                totalDuration,
              },
            },
          },
        });
      })
    );

    // 5. Start render workflow via Temporal for each platform
    // Import video-worker client dynamically to avoid bundling issues
    const { startRenderWorkflow } = await import('@suro-buya/video-worker/client');

    const workflowIds = await Promise.all(
      renders.map(async (render) => {
        const workflowHandle = await startRenderWorkflow({
          videoRenderId: render.id,
          projectId,
          platforms: [render.platform[0]],
          maxAttempts: 3,
        });
        return workflowHandle.workflowId;
      })
    );

    // 6. Update project status to RENDERING
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: 'RENDERING' },
    });

    return NextResponse.json({
      message: 'Video render started',
      renders: renders.map((render, index) => ({
        id: render.id,
        videoUrl: render.videoUrl,
        thumbnailUrl: render.thumbnailUrl,
        duration: render.duration,
        width: render.width,
        height: render.height,
        resolution: render.resolution,
        platform: render.platform,
        codec: render.codec,
        status: render.status,
        workflowId: workflowIds[index],
        createdAt: render.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /retry — Retry a failed render by creating a new VideoRenderJob attempt */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { renderId } = retrySchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify render exists and belongs to this project
    const render = await prisma.videoRender.findUnique({
      where: { id: renderId },
      include: {
        renderJobs: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!render || render.projectId !== projectId) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 });
    }

    if (render.status === 'DONE') {
      return NextResponse.json({ error: 'Render is already complete' }, { status: 400 });
    }

    // 2. Get the latest attempt number
    const latestAttempt = render.renderJobs[0];
    const nextAttemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;

    if (nextAttemptNumber > 3) {
      return NextResponse.json({ error: 'Maximum retry attempts (3) reached' }, { status: 400 });
    }

    // 3. Create new VideoRenderJob record for the retry
    const newJob = await prisma.videoRenderJob.create({
      data: {
        renderId,
        attemptNumber: nextAttemptNumber,
        providerUsed: 'remotion+ffmpeg',
        status: 'PENDING',
      },
    });

    // 4. Update render status to RENDERING if it was FAILED
    if (render.status === 'FAILED') {
      await prisma.videoRender.update({
        where: { id: renderId },
        data: { status: 'RENDERING' },
      });
    }

    // 5. Start render workflow via Temporal
    const { startRenderWorkflow } = await import('@suro-buya/video-worker/client');

    const workflowHandle = await startRenderWorkflow({
      videoRenderId: renderId,
      projectId,
      platforms: render.platform as ['TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS'],
      maxAttempts: 3,
    });

    return NextResponse.json({
      message: 'Render retry started',
      renderJob: {
        id: newJob.id,
        attemptNumber: newJob.attemptNumber,
        status: newJob.status,
        workflowId: workflowHandle.workflowId,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET — Get export status (list all VideoRenders) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const { universeId, projectId } = await params;
    await assertCan(userId, universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');

    const project = await prisma.videoProject.findUnique({
      where: { id: projectId },
      select: { universeId: true, status: true, title: true },
    });

    if (!project || project.universeId !== universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const renders = await prisma.videoRender.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        renderJobs: {
          orderBy: { attemptNumber: 'desc' },
        },
      },
    });

    return NextResponse.json({
      projectStatus: project.status,
      title: project.title,
      renders: renders.map((r: typeof renders[number]) => ({
        id: r.id,
        videoUrl: r.videoUrl,
        thumbnailUrl: r.thumbnailUrl,
        duration: r.duration,
        width: r.width,
        height: r.height,
        resolution: r.resolution,
        platform: r.platform,
        codec: r.codec,
        status: r.status,
        fileSizeBytes: r.fileSizeBytes,
        createdAt: r.createdAt,
        renderJobs: r.renderJobs.map((job) => ({
          id: job.id,
          attemptNumber: job.attemptNumber,
          status: job.status,
          providerUsed: job.providerUsed,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error,
        })),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
