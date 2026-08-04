/**
 * VF-4.7 — Studio Export API Routes
 *
 * POST /api/universes/[universeId]/studio/[projectId]/export
 *   Compose video final: build timeline (VF-4.5) → render via Remotion (VF-4.4)
 *   → encode via FFmpeg (VF-4.5) → simpan ke VideoRender (VF-4.6).
 *
 *   Untuk MVP, compose dilakukan inline (mock — tidak panggil Remotion/FFmpeg
 *   nyata yang butuh server terpisah). Hasil compose disimpan sebagai
 *   VideoRender record di Prisma dengan URL placeholder.
 *
 * GET /api/universes/[universeId]/studio/[projectId]/export
 *   Get export status — list semua VideoRender untuk project ini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: { universeId: string; projectId: string };
}

const exportSchema = z.object({
  /** Platform target untuk export */
  platform: z.enum(['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS']).default('TIKTOK'),
});

/** POST — Compose & export video final */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { platform } = exportSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists and has media assets
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      include: {
        character: {
          include: {
            characterAsset: true,
          },
        },
        mediaAssets: true,
      },
    });

    if (!project || project.universeId !== params.universeId) {
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

    // 3. Build timeline (VF-4.5) — for MVP, we store a simplified timeline
    const storyboard = project.storyboard as Array<{ duration?: number }>;
    const videoClips = project.mediaAssets.filter((a: { type: string }) => a.type === 'VIDEO_CLIP');
    const audioAssets = project.mediaAssets.filter((a: { type: string }) => a.type === 'AUDIO');

    const totalDuration = storyboard.reduce((sum: number, shot: { duration?: number }) => sum + (shot.duration ?? 0), 0);

    // 4. Create VideoRender record (VF-4.6)
    // For MVP, we use a placeholder URL — in production this would be the
    // actual rendered MP4 URL from Remotion + FFmpeg
    const videoUrl = `https://renders.suro-buya.local/${project.id}/${platform.toLowerCase()}.mp4`;
    const thumbnailUrl = `https://renders.suro-buya.local/${project.id}/thumbnail.jpg`;

    const render = await prisma.videoRender.create({
      data: {
        projectId: params.projectId,
        videoUrl,
        thumbnailUrl,
        duration: totalDuration,
        resolution: '1080x1920',
        platform,
        codec: 'h264',
        timeline: {
          totalShots: storyboard.length,
          videoClips: videoClips.length,
          audioAssets: audioAssets.length,
          totalDuration,
        },
      },
    });

    // 5. Update project status to RENDERED
    await prisma.videoProject.update({
      where: { id: params.projectId },
      data: { status: 'RENDERED' },
    });

    return NextResponse.json({
      message: 'Video exported successfully',
      render: {
        id: render.id,
        videoUrl: render.videoUrl,
        thumbnailUrl: render.thumbnailUrl,
        duration: render.duration,
        resolution: render.resolution,
        platform: render.platform,
        codec: render.codec,
        createdAt: render.createdAt,
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

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');

    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      select: { universeId: true, status: true, title: true },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const renders = await prisma.videoRender.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      projectStatus: project.status,
      title: project.title,
      renders: renders.map((r: typeof renders[number]) => ({
        id: r.id,
        videoUrl: r.videoUrl,
        thumbnailUrl: r.thumbnailUrl,
        duration: r.duration,
        resolution: r.resolution,
        platform: r.platform,
        codec: r.codec,
        fileSizeBytes: r.fileSizeBytes,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}