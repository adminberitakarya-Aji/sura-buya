/**
 * VF-3.7 — Studio Generate API Routes
 *
 * POST /api/universes/[universeId]/studio/[projectId]/generate
 *   Start media generation for all shots in the storyboard — via Temporal
 *   (video-worker, VF-3.5), BUKAN inline dalam HTTP request handler.
 *
 *   Cuma men-START workflow lalu return SEGERA (tidak menunggu generate
 *   selesai) — generate sesungguhnya berjalan di proses `video-worker`
 *   yang terpisah (long-running, di luar Next.js/Vercel serverless
 *   function). Ini penting: kalau generate dilakukan sinkron di dalam
 *   request handler, storyboard dengan banyak shot + video generation
 *   asli (Kling/Seedance, bisa menitan per clip) akan nyaris pasti kena
 *   timeout serverless function (biasa 10-60 detik). Video-worker via
 *   Temporal sudah didesain khusus untuk long-running job seperti ini,
 *   lengkap dengan retry, resume-on-crash, dan idempotency guard
 *   (lihat apps/video-worker/src/activities/media-generation.ts).
 *
 *   Frontend (generate/page.tsx) polling GET setiap 2 detik untuk lihat
 *   progress — MediaAsset di-update oleh workflow lewat activity
 *   updateMediaAssetStatus(), bukan oleh route ini.
 *
 * GET /api/universes/[universeId]/studio/[projectId]/generate
 *   Get generation status — DAN sekaligus jadi "reconciler": begitu
 *   IMAGE MediaAsset suatu shot sudah DONE dan mode generate adalah 'all',
 *   route ini yang men-START VIDEO_CLIP workflow untuk shot itu (karena
 *   VIDEO_CLIP butuh keyframeUrl dari IMAGE yang baru selesai — tidak bisa
 *   di-start bersamaan dengan IMAGE di POST). Pola ini cocok dengan
 *   frontend yang sudah polling GET setiap 2 detik, jadi tidak perlu
 *   endpoint/mekanisme baru untuk "lanjut ke video setelah image selesai".
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

interface RouteParams {
  params: { universeId: string; projectId: string };
}

const startGenerateSchema = z.object({
  /** Generate hanya IMAGE keyframe, atau IMAGE + VIDEO_CLIP? Default: 'all' */
  mode: z.enum(['images', 'all']).default('all'),
  
  /** Generate AUDIO (voiceover/SFX/BGM) — default true */
  audio: z.boolean().default(true),
});

/**
 * Start Temporal MediaJob workflow untuk satu MediaAsset — dipakai untuk
 * IMAGE (dari POST) maupun VIDEO_CLIP (dari GET reconciler).
 *
 * Idempotent secara alami: workflowId Temporal = `media-job-${mediaAssetId}`
 * (lihat video-worker/src/client.ts). Kalau workflow dengan ID itu sudah
 * berjalan (mis. GET reconciler jalan 2x sebelum job pertama selesai),
 * Temporal melempar WorkflowExecutionAlreadyStartedError — kita tangkap
 * dan anggap sebagai "sudah jalan, tidak perlu start lagi", bukan error.
 */
async function startMediaJobSafe(input: {
  mediaAssetId: string;
  projectId: string;
  shotIndex: number;
  type: 'IMAGE' | 'VIDEO_CLIP';
  shotSpec: unknown;
  visualProfile?: unknown;
  artStyle?: string;
  keyframeUrl?: string;
}): Promise<{ started: boolean }> {
  const { startMediaJob } = await import('@suro-buya/video-worker/client');
  const { WorkflowExecutionAlreadyStartedError } = await import('@temporalio/client');

  try {
    await startMediaJob(input as any);
    return { started: true };
  } catch (err) {
    if (err instanceof WorkflowExecutionAlreadyStartedError) {
      // Sudah jalan dari trigger sebelumnya (mis. polling GET yang overlap) — bukan error.
      return { started: false };
    }
    throw err;
  }
}

/** POST — Start generation (fire-and-forget, TIDAK menunggu generate selesai) */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json().catch(() => ({}));
    const { mode, audio } = startGenerateSchema.parse(body);

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

    const visualProfile = project.character?.characterAsset
      ? {
          referenceImages: project.character.characterAsset.referenceImages,
          styleTags: (project.character.metadata as any)?.styleTags ?? [],
          colorPalette: (project.character.metadata as any)?.colorPalette ?? [],
          negativePrompt: (project.character.metadata as any)?.negativePrompt,
        }
      : undefined;
    const artStyle = (project.settings as any)?.artStyle;

    // 2. Persist `mode` di project.settings — dibaca oleh GET reconciler untuk
    //    tahu apakah harus auto-lanjut ke VIDEO_CLIP setelah IMAGE selesai.
    await prisma.videoProject.update({
      where: { id: params.projectId },
      data: {
        status: 'GENERATING',
        settings: { ...((project.settings as object) ?? {}), generateMode: mode },
      },
    });

    // 3. Create MediaAsset (IMAGE) per shot yang belum ada, lalu START workflow-nya.
    //    TIDAK menunggu hasil — hanya menjadwalkan job ke Temporal task queue.
    const started: { shotIndex: number; type: string; subtype?: string; started: boolean }[] = [];

    for (const shot of storyboard) {
      const shotIndex = shot.index;

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

      // Cuma start kalau belum DONE/GENERATING — hindari re-trigger job yang
      // sudah selesai atau sedang berjalan.
      if (imageAsset.status === 'PENDING' || imageAsset.status === 'FAILED') {
        const { started: didStart } = await startMediaJobSafe({
          mediaAssetId: imageAsset.id,
          projectId: params.projectId,
          shotIndex,
          type: 'IMAGE',
          shotSpec: shot,
          visualProfile,
          artStyle,
        });
        started.push({ shotIndex, type: 'IMAGE', started: didStart });
      } else {
        started.push({ shotIndex, type: 'IMAGE', started: false });
      }
    }

    // 5. Audio generation (VOICEOVER + SFX + BGM) — synchronous for SFX/BGM,
    //    Temporal workflow for VOICEOVER.
    if (audio) {
      // Import audio selectors
    const { selectSfxForShots, selectMusicForVideo } = await import('@suro-buya/engine-v2');
      
      // 5a. VOICEOVER — per shot dengan dialogue, create MediaAsset + start Temporal workflow
      for (const shot of storyboard) {
        if (!shot.dialogue) continue; // skip shot tanpa dialog
        
        const shotIndex = shot.index;
        let voiceAsset = await prisma.mediaAsset.findFirst({
          where: { projectId: params.projectId, shotIndex, type: 'AUDIO', subtype: 'VOICEOVER' },
        });
        
        if (!voiceAsset) {
          voiceAsset = await prisma.mediaAsset.create({
            data: {
              projectId: params.projectId,
              shotIndex,
              type: 'AUDIO',
              subtype: 'VOICEOVER',
              status: 'PENDING',
              providerAttempts: [],
            },
          });
        }
        
        if (voiceAsset.status === 'PENDING' || voiceAsset.status === 'FAILED') {
          const { startMediaJob } = await import('@suro-buya/video-worker/client');
          try {
            await startMediaJob({
              mediaAssetId: voiceAsset.id,
              projectId: params.projectId,
              shotIndex,
              type: 'AUDIO',
              shotSpec: shot,
            });
            started.push({ shotIndex, type: 'AUDIO', subtype: 'VOICEOVER', started: true });
          } catch (err) {
            // Already started or other error - log and continue
            console.warn(`VOICEOVER workflow already started or error for shot ${shotIndex}:`, err);
            started.push({ shotIndex, type: 'AUDIO', subtype: 'VOICEOVER', started: false });
          }
        }
      }
      
      // 5b. SFX & BGM — hapus dulu selection lama untuk project ini sebelum
      //     insert baru. TIDAK pakai findFirst-per-item seperti VOICEOVER,
      //     karena SFX/BGM dipilih ulang dari SELURUH storyboard setiap kali
      //     endpoint ini dipanggil — kalau storyboard berubah, selection lama
      //     jadi tidak valid lagi (bukan cuma redundant) dan harus diganti
      //     total, bukan di-skip. Tanpa ini, tiap klik "Generate" ulang akan
      //     numpuk SFX/BGM duplikat di project yang sama (SFX bisa terdengar
      //     dobel/triple di video hasil render).
      await prisma.mediaAsset.deleteMany({
        where: {
          projectId: params.projectId,
          type: 'AUDIO',
          subtype: { in: ['SFX', 'BGM'] },
        },
      });

      // SFX — select from library, create MediaAsset with status DONE directly
      const sfxResult = selectSfxForShots(storyboard);
      for (const sfxSelection of sfxResult.selections) {
        const shotIndex = sfxSelection.shotIndex;
        for (const sfxEntry of sfxSelection.sfx) {
          await prisma.mediaAsset.create({
            data: {
              projectId: params.projectId,
              shotIndex,
              type: 'AUDIO',
              subtype: 'SFX',
              status: 'DONE',
              resultUrl: sfxEntry.url,
              metadata: {
                sfxType: sfxEntry.category,
                duration: sfxEntry.duration,
              },
              providerUsed: 'library',
              providerAttempts: [],
            },
          });
        }
      }
      
      // 5c. BGM — select from library, create MediaAsset with status DONE directly
      const bgmResult = selectMusicForVideo(storyboard, (project.settings as any)?.contentRating ?? 'ALL_AGES');
      if (bgmResult.primaryTrack) {
        await prisma.mediaAsset.create({
          data: {
            projectId: params.projectId,
            shotIndex: 0, // BGM applies to whole video, use shotIndex 0
            type: 'AUDIO',
            subtype: 'BGM',
            status: 'DONE',
            resultUrl: bgmResult.primaryTrack.url,
            metadata: {
              mood: bgmResult.inferredMood,
              duration: bgmResult.primaryTrack.duration,
              bpm: bgmResult.primaryTrack.bpm,
              genre: bgmResult.primaryTrack.genre,
            },
            providerUsed: 'library',
            providerAttempts: [],
          },
        });
      }
    }

    // 6. Return SEGERA — jangan tunggu generate selesai. Frontend polling GET
    //    (lihat generate/page.tsx) yang akan menampilkan progress real-time.
    return NextResponse.json({
      message: 'Generation started — poll GET for progress',
      started,
      totalShots: storyboard.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET — Get generation status (dan sekaligus reconciler untuk auto-start VIDEO_CLIP) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');

    // Verify project exists
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      select: {
        universeId: true,
        storyboard: true,
        status: true,
        title: true,
        settings: true,
      },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const storyboard = (project.storyboard as any[]) ?? [];
    const generateMode = (project.settings as any)?.generateMode as
      | 'images'
      | 'all'
      | undefined;

    // Reconciler: kalau mode 'all', untuk tiap shot yang IMAGE-nya sudah DONE
    // tapi VIDEO_CLIP belum pernah di-start, start VIDEO_CLIP workflow sekarang.
    // Ini yang menggantikan logic lama yang generate VIDEO_CLIP langsung di
    // dalam POST — sekarang di-drive oleh polling GET yang sudah ada di frontend.
    if (generateMode === 'all') {
      for (const shot of storyboard) {
        const shotIndex = shot.index;

        const imageAsset = await prisma.mediaAsset.findFirst({
          where: { projectId: params.projectId, shotIndex, type: 'IMAGE' },
        });
        if (!imageAsset || imageAsset.status !== 'DONE' || !imageAsset.resultUrl) {
          continue; // IMAGE belum selesai, belum bisa mulai VIDEO_CLIP
        }

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

        if (videoAsset.status === 'PENDING' || videoAsset.status === 'FAILED') {
          await startMediaJobSafe({
            mediaAssetId: videoAsset.id,
            projectId: params.projectId,
            shotIndex,
            type: 'VIDEO_CLIP',
            shotSpec: shot,
            keyframeUrl: imageAsset.resultUrl,
          });
        }
      }
    }

    // Get all MediaAssets for this project, ordered by shotIndex then type
    const mediaAssets = await prisma.mediaAsset.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ shotIndex: 'asc' }, { type: 'asc' }],
    });

    // Group by shotIndex
    const shots = storyboard.map((shot) => {
      const assets = mediaAssets.filter((a: typeof mediaAssets[number]) => a.shotIndex === shot.index);
      return {
        shotIndex: shot.index,
        shot,
        imageAsset: assets.find((a: typeof mediaAssets[number]) => a.type === 'IMAGE') ?? null,
        videoAsset: assets.find((a: typeof mediaAssets[number]) => a.type === 'VIDEO_CLIP') ?? null,
      };
    });

    const totalCost = mediaAssets.reduce((sum: number, a: typeof mediaAssets[number]) => sum + (a.cost ?? 0), 0);
    const allDone = mediaAssets.length > 0 && mediaAssets.every((a: typeof mediaAssets[number]) => a.status === 'DONE');

    // Update project status kalau semua sudah selesai (tidak menunggu polling terakhir)
    if (allDone && project.status !== 'RENDERED') {
      await prisma.videoProject.update({
        where: { id: params.projectId },
        data: { status: 'RENDERED' },
      });
    }

    return NextResponse.json({
      projectStatus: allDone ? 'RENDERED' : project.status,
      title: project.title,
      shots,
      totalCost,
      summary: {
        total: mediaAssets.length,
        done: mediaAssets.filter((a: typeof mediaAssets[number]) => a.status === 'DONE').length,
        failed: mediaAssets.filter((a: typeof mediaAssets[number]) => a.status === 'FAILED').length,
        pending: mediaAssets.filter((a: typeof mediaAssets[number]) => a.status === 'PENDING').length,
        generating: mediaAssets.filter((a: typeof mediaAssets[number]) => a.status === 'GENERATING').length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
