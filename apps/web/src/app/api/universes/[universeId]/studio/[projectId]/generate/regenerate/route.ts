/**
 * VF-3.7 — Studio Regenerate Single Shot API
 *
 * POST /api/universes/[universeId]/studio/[projectId]/generate/regenerate
 *   Regenerate a single shot's media asset (IMAGE or VIDEO_CLIP).
 *   Body: { shotIndex: number, type: 'IMAGE' | 'VIDEO_CLIP' }
 *
 *   This deletes the existing MediaAsset and creates a new one, then
 *   generates it inline. Used for "regenerate per shot" in the UI.
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

/** POST — Regenerate a single shot */
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

    // 2. Delete existing MediaAsset for this shot+type
    await prisma.mediaAsset.deleteMany({
      where: { projectId: params.projectId, shotIndex, type },
    });

    // 3. Create new MediaAsset
    let asset = await prisma.mediaAsset.create({
      data: {
        projectId: params.projectId,
        shotIndex,
        type,
        status: 'GENERATING',
        providerAttempts: [],
      },
    });

    // 4. Generate inline
    const { MediaProviderRegistry, MockImageProvider, MockVideoProvider, buildAllPrompts, resolveMotionPrompt } =
      await import('@suro-buya/engine-v2');

    try {
      if (type === 'IMAGE') {
        const registry = new MediaProviderRegistry();
        const mock = new MockImageProvider('mock-image-provider');
        registry.registerImageProvider(mock);
        registry.setImageChain([mock.name]);

        const visualProfile = project.character?.characterAsset
          ? {
              referenceImages: project.character.characterAsset.referenceImages,
              styleTags: (project.character.metadata as any)?.styleTags ?? [],
              colorPalette: (project.character.metadata as any)?.colorPalette ?? [],
              negativePrompt: (project.character.metadata as any)?.negativePrompt,
            }
          : undefined;

        const prompts = buildAllPrompts({
          shot,
          visualProfile,
          artStyle: (project.settings as any)?.artStyle,
        });

        const { result, providerUsed } = await registry.generateImage({
          prompt: prompts.visualPrompt,
          referenceImages: visualProfile?.referenceImages,
          negativePrompt: prompts.negativePrompt,
          aspectRatio: '9:16',
        });

        asset = await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            status: 'DONE',
            resultUrl: result.url,
            providerUsed,
            providerAttempts: [providerUsed],
            cost: result.cost ?? 0,
          },
        });
      } else {
        // VIDEO_CLIP — need keyframe URL from IMAGE asset
        const imageAsset = await prisma.mediaAsset.findFirst({
          where: { projectId: params.projectId, shotIndex, type: 'IMAGE' },
        });

        if (!imageAsset || imageAsset.status !== 'DONE' || !imageAsset.resultUrl) {
          asset = await prisma.mediaAsset.update({
            where: { id: asset.id },
            data: {
              status: 'FAILED',
              lastError: 'Keyframe image must be generated first before video clip',
            },
          });
          return NextResponse.json({ asset }, { status: 400 });
        }

        const registry = new MediaProviderRegistry();
        const mock = new MockVideoProvider('mock-video-provider');
        registry.registerVideoProvider(mock);
        registry.setVideoChain([mock.name]);

        const motion = resolveMotionPrompt(shot.motionPrompt, shot.cameraAngle, shot.duration);

        const { result, providerUsed } = await registry.generateVideoClip({
          keyframeUrl: imageAsset.resultUrl,
          motionPrompt: motion.prompt,
          duration: shot.duration,
          aspectRatio: '9:16',
        });

        asset = await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            status: 'DONE',
            resultUrl: result.url,
            providerUsed,
            providerAttempts: [providerUsed],
            cost: result.cost ?? 0,
          },
        });
      }
    } catch (err) {
      asset = await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: 'FAILED',
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    return errorResponse(error);
  }
}