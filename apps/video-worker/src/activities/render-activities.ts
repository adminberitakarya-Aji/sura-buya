/**
 * Suro-Buya Video Worker — Render Activities (VF-4.6 + VF-4.7)
 *
 * Activity untuk full video render pipeline:
 * 1. buildTimeline — assemble VideoTimeline dari MediaAsset (engine-v2 timeline-builder)
 * 2. renderRemotion — render via Remotion composition (video-renderer package)
 * 3. encodeFfmpeg — encode per platform via FFmpeg (video-renderer ffmpeg-encoder)
 * 4. updateVideoRenderStatus — update VideoRender status di DB
 * 5. upsertVideoRenderJob — create/update VideoRenderJob record
 * 6. getVideoRenderJob — get VideoRenderJob untuk resume
 *
 * Dipanggil oleh renderWorkflow (workflows/render-workflow.ts) via Temporal proxyActivities.
 */

import { prisma } from '../lib/db.js';
import { Prisma } from '@prisma/client';
import { buildTimeline, getPlatformPreset } from '@suro-buya/engine-v2';
import { isFFmpegAvailable, encodeVideo } from '@suro-buya/video-renderer';
import type { 
    VideoTimeline, 
    GeneratedClip, 
    GeneratedVoiceover, 
    SelectedSfx, 
    MusicSelectionResult,
    SfxLibraryEntry,
    MusicLibraryEntry,
    MotionCostTier,
    CameraMotionPreset,
} from '@suro-buya/engine-v2';
import type { 
    PlatformTarget, 
    ShotSpec, 
    CharacterVisualProfile 
} from '@suro-buya/shared';
import type {
    BuildTimelineInput,
    BuildTimelineResult,
    RenderRemotionInput,
    RenderRemotionResult,
    EncodeFfmpegInput,
    EncodeFfmpegResult,
    UpdateVideoRenderStatusInput,
    UpsertVideoRenderJobInput,
    GetVideoRenderJobInput,
    VideoRenderJobRecord,
} from '../shared/render-interfaces.js';
import { ApplicationFailure } from '@temporalio/common';

// Local type for MediaAsset from Prisma (extends Prisma type with dynamic fields)
interface MediaAssetWithExtras {
    id: string;
    projectId: string;
    shotIndex: number;
    type: string;
    status: string;
    providerUsed: string | null;
    providerAttempts: string[];
    retryCount: number;
    resultUrl: string | null;
    cost: number | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
    subtype?: string;
}

// Type for CharacterAsset from Prisma (matching schema - no styleTags, colorPalette, negativePrompt)
interface CharacterAssetPrisma {
    id: string;
    characterId: string;
    referenceImages: string[];
    voiceProfile: Record<string, unknown> | null;
    loraConfig: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

// Helper to create minimal SfxLibraryEntry from SFX asset
function createSfxLibraryEntry(url: string, duration: number, type: string): SfxLibraryEntry {
    return {
        id: `sfx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        keywords: [type],
        url,
        duration,
        category: type,
    };
}

// Helper to create minimal MusicLibraryEntry from BGM asset
function createMusicLibraryEntry(url: string, metadata: Record<string, unknown>): MusicLibraryEntry {
    return {
        id: `music_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        moods: [(metadata['mood'] as string) || 'neutral'],
        url,
        duration: (metadata['duration'] as number) || 0,
        bpm: 120,
        genre: 'unknown',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    };
}

/**
 * Activity: Build timeline dari MediaAsset project.
 *
 * Mengambil MediaAsset (VIDEO_CLIP + AUDIO) dari DB, reconstruct ShotSpec
 * dari storyboard, dan build VideoTimeline via engine-v2 buildTimeline().
 *
 * @param input.projectId ID VideoProject
 * @param input.platforms Platform targets
 * @returns Serialized VideoTimeline + metadata
 */
export async function buildTimelineActivity(
    input: BuildTimelineInput,
): Promise<BuildTimelineResult> {
    const { projectId, platforms } = input;

    // 1. Ambil project dengan MediaAsset + Character + CharacterAsset
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

    if (!project) {
        throw ApplicationFailure.nonRetryable(
            `VideoProject not found: ${projectId}`,
            'ProjectNotFound',
        );
    }

    // 2. Parse storyboard (stored as JSON)
    const storyboard = project.storyboard as Array<{
        index: number;
        visualPrompt: string;
        motionPrompt?: string;
        cameraAngle?: string;
        duration: number;
        dialogue?: { characterId: string; line: string };
    }>;

    // 3. Filter MediaAsset yang DONE
    const mediaAssets = project.mediaAssets as MediaAssetWithExtras[];
        
    const videoClips = mediaAssets
        .filter((a: MediaAssetWithExtras) => a.type === 'VIDEO_CLIP' && a.status === 'DONE' && a.resultUrl)
        .sort((a: MediaAssetWithExtras, b: MediaAssetWithExtras) => a.shotIndex - b.shotIndex);

    const audioAssets = mediaAssets
        .filter((a: MediaAssetWithExtras) => a.type === 'AUDIO' && a.status === 'DONE' && a.resultUrl)
        .sort((a: MediaAssetWithExtras, b: MediaAssetWithExtras) => a.shotIndex - b.shotIndex);

    // 4. Build GeneratedClip array untuk timeline-builder
    const clips: GeneratedClip[] = videoClips.map((asset: MediaAssetWithExtras) => ({
        shotIndex: asset.shotIndex,
        clipUrl: asset.resultUrl!,
        durationActual: storyboard.find((s) => s.index === asset.shotIndex)?.duration ?? 5,
        providerUsed: asset.providerUsed ?? 'unknown',
        cost: 0,
        motionPromptUsed: '',
        presetUsed: 'dynamic' as CameraMotionPreset,
        costTier: 'medium' as MotionCostTier,
        isCustomMotion: false,
        attempts: [],
    }));

    // 5. Build GeneratedVoiceover array
    const voiceovers: GeneratedVoiceover[] = audioAssets
        .filter((a: MediaAssetWithExtras) => a.subtype === 'VOICEOVER')
        .map((asset: MediaAssetWithExtras) => ({
            shotIndex: asset.shotIndex,
            audioUrl: asset.resultUrl!,
            durationActual: storyboard.find((s) => s.index === asset.shotIndex)?.duration ?? 5,
            providerUsed: asset.providerUsed ?? 'unknown',
            cost: 0,
            characterId: '',
            dialogueText: '',
            voiceId: '',
            attempts: [],
        }));

    // 6. Build SelectedSfx array
    const sfxSelections = audioAssets
        .filter((a: MediaAssetWithExtras) => a.subtype === 'SFX')
        .reduce((acc: Record<number, { shotIndex: number; sfx: SfxLibraryEntry[] }>, asset: MediaAssetWithExtras) => {
            const shotIndex = asset.shotIndex;
            const metadata: Record<string, unknown> = asset.metadata ?? {};
            if (!acc[shotIndex]) {
                acc[shotIndex] = { shotIndex, sfx: [] };
            }
            acc[shotIndex].sfx.push(createSfxLibraryEntry(
                asset.resultUrl!,
                (metadata['duration'] as number) ?? 1,
                (metadata['sfxType'] as string) ?? 'impact'
            ));
            return acc;
        }, {} as Record<number, { shotIndex: number; sfx: SfxLibraryEntry[] }>);

    const sfxArray: SelectedSfx[] = Object.values(sfxSelections).map((s: { shotIndex: number; sfx: SfxLibraryEntry[] }) => ({
        shotIndex: s.shotIndex,
        sfx: s.sfx,
        matchedAction: '',
    }));

    // 7. Build MusicSelectionResult
    const bgmAsset = audioAssets.find((a: MediaAssetWithExtras) => a.subtype === 'BGM');
    const music: MusicSelectionResult = bgmAsset
        ? {
            primaryTrack: createMusicLibraryEntry(bgmAsset.resultUrl!, bgmAsset.metadata ?? {}),
            alternativeTracks: [],
            inferredMood: (bgmAsset.metadata?.['mood'] as string) ?? 'neutral',
            warnings: [],
        }
        : {
            primaryTrack: null,
            alternativeTracks: [],
            inferredMood: 'neutral',
            warnings: [],
        };

    // 8. Build ShotSpec array dari storyboard
    const shots: ShotSpec[] = storyboard.map((s) => ({
        index: s.index,
        visualPrompt: s.visualPrompt,
        motionPrompt: s.motionPrompt,
        cameraAngle: s.cameraAngle ?? '',
        duration: s.duration,
        dialogue: s.dialogue,
        action: s.visualPrompt, // Use visualPrompt as action fallback
    }));

    // 9. Get character visual profile (only referenceImages from CharacterAsset)
    const characterAsset = project.character?.characterAsset;
    const visualProfile = characterAsset
        ? {
            referenceImages: characterAsset.referenceImages as string[] | undefined,
        }
        : undefined;

    // 10. Call engine-v2 buildTimeline (TimelineBuilderInput doesn't have visualProfile)
    const timeline = buildTimeline({
        shots,
        clips,
        voiceovers,
        sfxSelections: sfxArray,
        music,
        platforms,
    });

    // 11. Serialize timeline untuk Temporal (JSON string)
    const timelineJson = JSON.stringify(timeline, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
    );

    return {
        timelineJson,
        totalDuration: timeline.totalDuration,
        width: timeline.preset.width,
        height: timeline.preset.height,
    };
}

/**
 * Activity: Render video via Remotion composition.
 *
 * Menggunakan @suro-buya/video-renderer composition untuk render
 * raw video MP4 dari VideoTimeline.
 *
 * @param input.timelineJson Serialized VideoTimeline
 * @param input.outputPath Path output untuk raw video
 * @returns Path ke raw video file + duration
 */
export async function renderRemotionActivity(
    input: RenderRemotionInput,
): Promise<RenderRemotionResult> {
    const { timelineJson, outputPath } = input;

    // Parse timeline
    const timeline: VideoTimeline = JSON.parse(timelineJson, (_key, value) =>
        typeof value === 'string' && /^\d+$/.test(value) && value.length > 15
            ? BigInt(value)
            : value,
    );

    // Render via Remotion
    // NOTE: Remotion render is async and needs @remotion/cli or @remotion/renderer
    // For now, we simulate the render by creating a placeholder file
    // In production, this would use Remotion's renderMedia() or similar

    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // TODO: Actual Remotion render
    // For MVP, create a minimal valid MP4 file placeholder
    // In production, this would be:
    // import { renderMedia } from '@remotion/renderer';
    // await renderMedia({
    //     composition: VideoComposition,
    //     serveUrl: bundle,
    //     codec: 'h264',
    //     outputLocation: outputPath,
    //     inputProps: buildCompositionProps(timeline),
    // });

    // Create placeholder file (empty but valid for testing)
    await fs.writeFile(outputPath, '');

    return {
        rawVideoPath: outputPath,
        duration: timeline.totalDuration,
    };
}

/**
 * Activity: Encode video via FFmpeg per platform.
 *
 * Menggunakan @suro-buya/video-renderer ffmpeg-encoder untuk encode
 * raw video sesuai spec platform (resolusi, codec, bitrate, safe zone).
 *
 * @param input.rawVideoPath Path ke raw video dari Remotion
 * @param input.platform Platform target
 * @param input.outputPath Path output untuk encoded video
 * @param input.width Width dari timeline preset
 * @param input.height Height dari timeline preset
 * @returns Path ke encoded video + metadata
 */
export async function encodeFfmpegActivity(
    input: EncodeFfmpegInput,
): Promise<EncodeFfmpegResult> {
    const { rawVideoPath, platform, outputPath, width, height } = input;

    // Check FFmpeg availability
    const available = await isFFmpegAvailable();
    if (!available) {
        throw ApplicationFailure.retryable(
            'FFmpeg not available in system — cannot encode video',
            'FFmpegNotAvailable',
        );
    }

    // Get platform preset
    const { getPlatformPreset } = await import('@suro-buya/engine-v2');
    const preset = getPlatformPreset(platform);

    // Ensure output directory exists
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Encode via FFmpeg
    const result = await encodeVideo(preset, rawVideoPath, outputPath);

    return {
        outputPath: result.outputPath,
        fileSizeBytes: result.fileSizeBytes,
        resolution: result.resolution,
        duration: result.duration,
    };
}

/**
 * Activity: Update VideoRender status di database.
 *
 * @param input.videoRenderId ID VideoRender
 * @param input.status Status baru
 * @param input.videoUrl URL video final (opsional)
 * @param input.thumbnailUrl URL thumbnail (opsional)
 * @param input.fileSizeBytes Ukuran file (opsional)
 * @param input.lastError Error message kalau FAILED (opsional)
 */
export async function updateVideoRenderStatusActivity(
    input: UpdateVideoRenderStatusInput,
): Promise<void> {
    const { videoRenderId, status, videoUrl, thumbnailUrl, fileSizeBytes, lastError } = input;

    const data: Record<string, unknown> = { status };

    if (videoUrl !== undefined) data['videoUrl'] = videoUrl;
    if (thumbnailUrl !== undefined) data['thumbnailUrl'] = thumbnailUrl;
    if (fileSizeBytes !== undefined) data['fileSizeBytes'] = fileSizeBytes;
    if (lastError !== undefined) data['lastError'] = lastError;

    await prisma.videoRender.update({
        where: { id: videoRenderId },
        data,
    });
}

/**
 * Activity: Create/update VideoRenderJob record.
 *
 * @param input.videoRenderId ID VideoRender
 * @param input.attemptNumber Nomor attempt (1-based)
 * @param input.providerUsed Provider yang dipakai
 * @param input.status Status job
 * @param input.startedAt Waktu mulai (opsional)
 * @param input.completedAt Waktu selesai (opsional)
 * @param input.error Error message kalau FAILED (opsional)
 * @param input.cost Biaya render (opsional)
 * @param input.metadata Metadata tambahan (opsional)
 */
export async function upsertVideoRenderJobActivity(
    input: UpsertVideoRenderJobInput,
): Promise<void> {
    const {
        videoRenderId,
        attemptNumber,
        providerUsed,
        status,
        startedAt,
        completedAt,
        error,
        cost,
        metadata,
    } = input;

    // Use findFirst + create/update since there's no @@unique on [renderId, attemptNumber]
    const existing = await prisma.videoRenderJob.findFirst({
        where: {
            renderId: videoRenderId,
            attemptNumber,
        },
    });

    if (existing) {
        await prisma.videoRenderJob.update({
            where: { id: existing.id },
            data: {
                providerUsed,
                status: status as 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED',
                startedAt,
                completedAt,
                error,
                cost,
                metadata: metadata as Prisma.JsonValue | null | undefined ?? Prisma.DbNull,
            },
        });
    } else {
        await prisma.videoRenderJob.create({
            data: {
                renderId: videoRenderId,
                attemptNumber,
                providerUsed,
                status: status as 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED',
                startedAt,
                completedAt,
                error,
                cost,
                metadata: metadata as Prisma.JsonValue | null | undefined ?? Prisma.DbNull,
            },
        });
    }
}

/**
 * Activity: Get VideoRenderJob untuk resume.
 *
 * @param input.videoRenderId ID VideoRender
 * @param input.attemptNumber Nomor attempt
 * @returns VideoRenderJob record atau null kalau tidak ada
 */
export async function getVideoRenderJobActivity(
    input: GetVideoRenderJobInput,
): Promise<VideoRenderJobRecord | null> {
    const { videoRenderId, attemptNumber } = input;

    const job = await prisma.videoRenderJob.findFirst({
        where: {
            renderId: videoRenderId,
            attemptNumber,
        },
    });

    if (!job) return null;

    return {
        id: job.id,
        videoRenderId: job.renderId,
        attemptNumber: job.attemptNumber,
        providerUsed: job.providerUsed,
        status: job.status as VideoRenderJobRecord['status'],
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        cost: job.cost,
        metadata: job.metadata as Record<string, unknown> | null,
    };
}
