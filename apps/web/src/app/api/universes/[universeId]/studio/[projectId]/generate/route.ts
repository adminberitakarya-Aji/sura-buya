/**
 * VF-3.7 — Studio Generate API Routes
 *
 * POST /api/universes/[universeId]/studio/[projectId]/generate
 *   Start media generation for all shots in the storyboard.
 *   Creates MediaAsset records (IMAGE per shot, VIDEO_CLIP per shot) and
 *   generates keyframes inline via engine-v2 ImageProvider registry.
 *   Falls back to mock provider if no API keys configured.
 *
 * GET /api/universes/[universeId]/studio/[projectId]/generate
 *   Get generation status — all MediaAssets for this project, grouped by shot.
 *   Returns per-shot status (PENDING/GENERATING/DONE/FAILED), resultUrl, cost.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: { universeId: string; projectId: string };
}

const startGenerateSchema = z.object({
  /** Generate only IMAGE keyframes, or both IMAGE + VIDEO_CLIP? Default: 'all' */
  mode: z.enum(['images', 'all']).default('all'),
});

/**
 * Build a mock image registry for development without API keys.
 * Same pattern as parse-persona VF-1.8 and script VF-2.6.
 */
async function generateKeyframeInline(
  shotSpec: any,
  visualProfile: any,
  artStyle: string | undefined,
): Promise<{ url: string; providerUsed: string; cost: number }> {
  // Dynamic import to avoid bundling engine-v2 in the route
  const { createImageProviderRegistry, MediaProviderRegistry, MockImageProvider } =
    await import('@suro-buya/engine-v2');

  const registry = new MediaProviderRegistry();
  const mock = new MockImageProvider('mock-image-provider');
  registry.registerImageProvider(mock);
  registry.setImageChain([mock.name]);

  const { buildAllPrompts } = await import('@suro-buya/engine-v2');
  const prompts = buildAllPrompts({ shot: shotSpec, visualProfile, artStyle });

  const { result, providerUsed } = await registry.generateImage({
    prompt: prompts.visualPrompt,
    referenceImages: visualProfile?.referenceImages,
    negativePrompt: prompts.negativePrompt,
    aspectRatio: '9:16',
  });

  return { url: result.url, providerUsed, cost: result.cost ?? 0 };
}

/**
 * Generate a video clip inline (mock for MVP — real video gen via Temporal in production).
 */
async function generateVideoClipInline(
  keyframeUrl: string,
  shotSpec: any,
): Promise<{ url: string; providerUsed: string; cost: number }> {
  const { createVideoProviderRegistry, MediaProviderRegistry, MockVideoProvider, resolveMotionPrompt } =
    await import('@suro-buya/engine-v2');

  const registry = new MediaProviderRegistry();
  const mock = new MockVideoProvider('mock-video-provider');
  registry.registerVideoProvider(mock);
  registry.setVideoChain([mock.name]);

  const motion = resolveMotionPrompt(shotSpec.motionPrompt, shotSpec.cameraAngle, shotSpec.duration);

  const { result, providerUsed } = await registry.generateVideoClip({
    keyframeUrl,
    motionPrompt: motion.prompt,
    duration: shotSpec.duration,
    aspectRatio: '9:16',
  });

  return { url: result.url, providerUsed, cost: result.cost ?? 0 };
}

/** POST — Start generation */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { mode } = startGenerateSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // 1. Verify project exists and has a storyboard
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
        { error: 'Storyboard is empty — generate storyboard first' },
        { status: 400 },
      );
    }

    // 2. Update project status to GENERATING
    await prisma.videoProject.update({
      where: { id: params.projectId },
      data: { status: 'GENERATING' },
    });

    // 3. Create or update MediaAsset records for each shot
    const results: any[] = [];

    for (const shot of storyboard) {
      const shotIndex = shot.index;

      // Check if IMAGE MediaAsset already exists for this shot
      let imageAsset = await prisma.mediaAsset.findFirst({
        where: { projectId: params.projectId, shotIndex, type: 'IMAGE' },
      });

      if (!imageAsset) {
        imageAsset = await prisma.mediaAsset.create({
          data: {
            projectId: params.projectId,
            shotIndex,
            type: 'IMAGE',
            status: 'PENDING',
            providerAttempts: [],
          },
        });
      }

      // Generate keyframe inline
      if (imageAsset.status !== 'DONE') {
        await prisma.mediaAsset.update({
          where: { id: imageAsset.id },
          data: { status: 'GENERATING' },
        });

        try {
          const visualProfile = project.character?.characterAsset
            ? {
                referenceImages: project.character.characterAsset.referenceImages,
                styleTags: (project.character.metadata as any)?.styleTags ?? [],
                colorPalette: (project.character.metadata as any)?.colorPalette ?? [],
                negativePrompt: (project.character.metadata as any)?.negativePrompt,
              }
            : undefined;

          const result = await generateKeyframeInline(
            shot,
            visualProfile,
            (project.settings as any)?.artStyle,
          );

          imageAsset = await prisma.mediaAsset.update({
            where: { id: imageAsset.id },
            data: {
              status: 'DONE',
              resultUrl: result.url,
              providerUsed: result.providerUsed,
              providerAttempts: [result.providerUsed],
              cost: result.cost,
            },
          });
        } catch (err) {
          imageAsset = await prisma.mediaAsset.update({
            where: { id: imageAsset.id },
            data: {
              status: 'FAILED',
              lastError: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }

      results.push({ shotIndex, type: 'IMAGE', asset: imageAsset });

      // Generate VIDEO_CLIP if mode is 'all' and image is DONE
      if (mode === 'all' && imageAsset.status === 'DONE' && imageAsset.resultUrl) {
        let videoAsset = await prisma.mediaAsset.findFirst({
          where: { projectId: params.projectId, shotIndex, type: 'VIDEO_CLIP' },
        });

        if (!videoAsset) {
          videoAsset = await prisma.mediaAsset.create({
            data: {
              projectId: params.projectId,
              shotIndex,
              type: 'VIDEO_CLIP',
              status: 'PENDING',
              providerAttempts: [],
            },
          });
        }

        if (videoAsset.status !== 'DONE') {
          await prisma.mediaAsset.update({
            where: { id: videoAsset.id },
            data: { status: 'GENERATING' },
          });

          try {
            const result = await generateVideoClipInline(imageAsset.resultUrl, shot);

            videoAsset = await prisma.mediaAsset.update({
              where: { id: videoAsset.id },
              data: {
                status: 'DONE',
                resultUrl: result.url,
                providerUsed: result.providerUsed,
                providerAttempts: [result.providerUsed],
                cost: result.cost,
              },
            });
          } catch (err) {
            videoAsset = await prisma.mediaAsset.update({
              where: { id: videoAsset.id },
              data: {
                status: 'FAILED',
                lastError: err instanceof Error ? err.message : String(err),
              },
            });
          }
        }

        results.push({ shotIndex, type: 'VIDEO_CLIP', asset: videoAsset });
      }
    }

    // 4. Update project status based on results
    const allDone = results.every((r) => r.asset.status === 'DONE');
    const anyFailed = results.some((r) => r.asset.status === 'FAILED');

    await prisma.videoProject.update({
      where: { id: params.projectId },
      data: { status: allDone ? 'RENDERED' : anyFailed ? 'GENERATING' : 'GENERATING' },
    });

    const totalCost = results.reduce((sum, r) => sum + (r.asset.cost ?? 0), 0);

    return NextResponse.json({
      results,
      totalCost,
      summary: {
        total: results.length,
        done: results.filter((r) => r.asset.status === 'DONE').length,
        failed: results.filter((r) => r.asset.status === 'FAILED').length,
        pending: results.filter((r) => r.asset.status === 'PENDING').length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET — Get generation status */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');

    // Verify project exists
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      select: { universeId: true, storyboard: true, status: true, title: true },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all MediaAssets for this project, ordered by shotIndex then type
    const mediaAssets = await prisma.mediaAsset.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ shotIndex: 'asc' }, { type: 'asc' }],
    });

    // Group by shotIndex
    const storyboard = (project.storyboard as any[]) ?? [];
    const shots = storyboard.map((shot) => {
      const assets = mediaAssets.filter((a) => a.shotIndex === shot.index);
      return {
        shotIndex: shot.index,
        shot,
        imageAsset: assets.find((a) => a.type === 'IMAGE') ?? null,
        videoAsset: assets.find((a) => a.type === 'VIDEO_CLIP') ?? null,
      };
    });

    const totalCost = mediaAssets.reduce((sum, a) => sum + (a.cost ?? 0), 0);

    return NextResponse.json({
      projectStatus: project.status,
      title: project.title,
      shots,
      totalCost,
      summary: {
        total: mediaAssets.length,
        done: mediaAssets.filter((a) => a.status === 'DONE').length,
        failed: mediaAssets.filter((a) => a.status === 'FAILED').length,
        pending: mediaAssets.filter((a) => a.status === 'PENDING').length,
        generating: mediaAssets.filter((a) => a.status === 'GENERATING').length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}