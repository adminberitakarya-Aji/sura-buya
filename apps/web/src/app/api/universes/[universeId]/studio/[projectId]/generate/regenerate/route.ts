/**
 * VF-3.7 — Studio Regenerate Single Shot API
 *
 * POST /api/universes/[universeId]/studio/[projectId]/generate/regenerate
 *   Regenerate a single shot's media asset (IMAGE or VIDEO_CLIP) — via
 *   Temporal (video-worker, VF-3.5), sama seperti /generate. Hapus
 *   MediaAsset lama, buat yang baru (PENDING), lalu start workflow-nya.
 *   TIDAK menunggu selesai — frontend polling GET /generate untuk progress
 *   (lihat catatan lengkap di ../route.ts).
 *
 *   Pakai record MediaAsset BARU (bukan reset yang lama) supaya idempotency
 *   guard di video-worker (checkAlreadyDone — lihat media-generation.ts)
 *   tidak keliru menganggap job ini "sudah DONE" dari sebelumnya dan
 *   men-skip generate ulang, yang justru berlawanan dengan maksud regenerate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: { universeId: string; projectId: string };
}

const regenerateSchema = z.object({
  shotIndex: z.number().int().min(0),
  type: z.enum(['IMAGE', 'VIDEO_CLIP']),
});

/** POST — Regenerate a single shot (fire-and-forget via Temporal) */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const { shotIndex, type } = regenerateSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists and get storyboard
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      include: {
        character: {
          include: {
            characterAsset: true,
          },
        },
      },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const storyboard = project.storyboard as any[];
    if (!Array.isArray(storyboard) || storyboard.length === 0) {
      return NextResponse.json(
        { error: 'Storyboard is empty' },
        { status: 400 },
      );
    }

    const shot = storyboard.find((s) => s.index === shotIndex);
    if (!shot) {
      return NextResponse.json(
        { error: `Shot ${shotIndex} not found in storyboard` },
        { status: 404 },
      );
    }

    let keyframeUrl: string | undefined;
    if (type === 'VIDEO_CLIP') {
      const imageAsset = await prisma.mediaAsset.findFirst({
        where: { projectId: params.projectId, shotIndex, type: 'IMAGE' },
      });
      if (!imageAsset || imageAsset.status !== 'DONE' || !imageAsset.resultUrl) {
        return NextResponse.json(
          { error: 'Keyframe image must be generated first before video clip' },
          { status: 400 },
        );
      }
      keyframeUrl = imageAsset.resultUrl;
    }

    // 2. Hapus MediaAsset lama untuk shot+type ini, buat yang baru (PENDING) —
    //    id baru supaya idempotency guard video-worker tidak salah-kira "sudah DONE".
    await prisma.mediaAsset.deleteMany({
      where: { projectId: params.projectId, shotIndex, type },
    });

    const asset = await prisma.mediaAsset.create({
      data: {
        projectId: params.projectId,
        shotIndex,
        type,
        status: 'PENDING',
        providerAttempts: [],
      },
    });

    // 3. Start workflow-nya via Temporal — TIDAK menunggu selesai.
    const { startMediaJob } = await import('@suro-buya/video-worker/client');

    const visualProfile =
      type === 'IMAGE' && project.character?.characterAsset
        ? {
            referenceImages: project.character.characterAsset.referenceImages,
            styleTags: (project.character.metadata as any)?.styleTags ?? [],
            colorPalette: (project.character.metadata as any)?.colorPalette ?? [],
            negativePrompt: (project.character.metadata as any)?.negativePrompt,
          }
        : undefined;

    await startMediaJob({
      mediaAssetId: asset.id,
      projectId: params.projectId,
      shotIndex,
      type,
      shotSpec: shot,
      visualProfile,
      artStyle: (project.settings as any)?.artStyle,
      keyframeUrl,
    } as any);

    return NextResponse.json({ asset, message: 'Regeneration started — poll GET /generate for progress' });
  } catch (error) {
    return errorResponse(error);
  }
}