/**
 * Suro-Buya Engine v2 - Platform Preset (VF-4.5)
 *
 * Preset spesifikasi platform target untuk video export. Menentukan
 * resolusi, safe zone, codec, dan format yang sesuai dengan tiap platform
 * (TikTok, YouTube Shorts, Instagram Reels).
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-4.5:
 * "Assemble timeline, encode sesuai spec platform"
 *
 * Dan VF-4 Acceptance Criteria #4:
 * "Output memenuhi spesifikasi platform (1080x1920, safe zone, codec)"
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan sfx-selector.ts (VF-4.3).
 */

import type { PlatformTarget } from '@suro-buya/shared';

/**
 * Spesifikasi encode untuk satu platform target.
 */
export interface PlatformPreset {
    /** Platform target, mis. "TIKTOK" */
    platform: PlatformTarget;

    /** Resolusi width x height, mis. "1080x1920" */
    resolution: string;

    /** Width dalam pixel */
    width: number;

    /** Height dalam pixel */
    height: number;

    /** Aspect ratio, mis. "9:16" */
    aspectRatio: '9:16' | '16:9' | '1:1';

    /** Codec video, mis. "h264" */
    videoCodec: string;

    /** Codec audio, mis. "aac" */
    audioCodec: string;

    /** Bitrate video target dalam kbps */
    videoBitrateKbps: number;

    /** Bitrate audio target dalam kbps */
    audioBitrateKbps: number;

    /** Frame rate, mis. 30 */
    frameRate: number;

    /** Container format, mis. "mp4" */
    container: string;

    /** Safe zone — margin dari tepi (dalam persen) yang tidak boleh ada teks penting */
    safeZoneMarginPercent: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };

    /** Max durasi video dalam detik (platform limit) */
    maxDurationSec: number;

    /** Max file size dalam MB (platform limit) */
    maxFileSizeMb: number;
}

/**
 * Preset untuk semua platform yang didukung.
 *
 * Berdasarkan spec platform resmi (Agustus 2026):
 * - TikTok: 1080x1920, H.264, 30fps, max 10 menit (Shorts biasanya 15-60s)
 * - YouTube Shorts: 1080x1920, H.264, 30fps, max 60s
 * - Instagram Reels: 1080x1920, H.264, 30fps, max 90s
 */
export const PLATFORM_PRESETS: Record<PlatformTarget, PlatformPreset> = {
    TIKTOK: {
        platform: 'TIKTOK',
        resolution: '1080x1920',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        videoCodec: 'h264',
        audioCodec: 'aac',
        videoBitrateKbps: 5000,
        audioBitrateKbps: 128,
        frameRate: 30,
        container: 'mp4',
        safeZoneMarginPercent: {
            top: 15,    // area untuk username + caption
            bottom: 20, // area untuk tombol like/share/comment
            left: 5,
            right: 5,
        },
        maxDurationSec: 600, // 10 menit (tapi Shorts biasanya 15-60s)
        maxFileSizeMb: 287,
    },
    YOUTUBE_SHORTS: {
        platform: 'YOUTUBE_SHORTS',
        resolution: '1080x1920',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        videoCodec: 'h264',
        audioCodec: 'aac',
        videoBitrateKbps: 8000,
        audioBitrateKbps: 128,
        frameRate: 30,
        container: 'mp4',
        safeZoneMarginPercent: {
            top: 10,
            bottom: 15, // area untuk judul + channel
            left: 5,
            right: 5,
        },
        maxDurationSec: 60,
        maxFileSizeMb: 256,
    },
    INSTAGRAM_REELS: {
        platform: 'INSTAGRAM_REELS',
        resolution: '1080x1920',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        videoCodec: 'h264',
        audioCodec: 'aac',
        videoBitrateKbps: 4000,
        audioBitrateKbps: 128,
        frameRate: 30,
        container: 'mp4',
        safeZoneMarginPercent: {
            top: 15,    // area untuk username
            bottom: 25, // area untuk caption + tombol
            left: 5,
            right: 5,
        },
        maxDurationSec: 90,
        maxFileSizeMb: 650,
    },
};

/**
 * Default preset — dipakai kalau platform tidak dispesifikkan.
 * Default: TikTok (paling umum untuk short-form vertical video).
 */
export const DEFAULT_PLATFORM_PRESET: PlatformPreset = PLATFORM_PRESETS.TIKTOK;

/**
 * Dapatkan preset untuk platform target.
 *
 * @param platform Platform target
 * @returns Platform preset
 */
export function getPlatformPreset(platform: PlatformTarget): PlatformPreset {
    return PLATFORM_PRESETS[platform] ?? DEFAULT_PLATFORM_PRESET;
}

/**
 * Dapatkan preset untuk multiple platform targets.
 *
 * @param platforms Array platform target
 * @returns Array platform preset
 */
export function getPlatformPresets(platforms: PlatformTarget[]): PlatformPreset[] {
    return platforms.map(getPlatformPreset);
}

/**
 * Validasi durasi video terhadap limit platform.
 *
 * @param durationSec Durasi video dalam detik
 * @param platform Platform target
 * @returns true kalau durasi dalam limit, false kalau melebihi
 */
export function isDurationWithinLimit(
    durationSec: number,
    platform: PlatformTarget,
): boolean {
    const preset = getPlatformPreset(platform);
    return durationSec <= preset.maxDurationSec;
}

/**
 * Hitung safe zone dalam pixel berdasarkan resolusi dan margin percent.
 *
 * @param preset Platform preset
 * @returns Safe zone dalam pixel { top, bottom, left, right }
 */
export function calculateSafeZonePixels(preset: PlatformPreset): {
    top: number;
    bottom: number;
    left: number;
    right: number;
} {
    return {
        top: Math.round((preset.safeZoneMarginPercent.top / 100) * preset.height),
        bottom: Math.round((preset.safeZoneMarginPercent.bottom / 100) * preset.height),
        left: Math.round((preset.safeZoneMarginPercent.left / 100) * preset.width),
        right: Math.round((preset.safeZoneMarginPercent.right / 100) * preset.width),
    };
}

/**
 * Build FFmpeg encode arguments untuk platform target.
 *
 * @param preset Platform preset
 * @param inputPath Path file input (raw video dari Remotion render)
 * @param outputPath Path file output (encoded MP4)
 * @returns Array argumen FFmpeg
 */
export function buildFFmpegArgs(
    preset: PlatformPreset,
    inputPath: string,
    outputPath: string,
): string[] {
    return [
        '-i', inputPath,
        '-c:v', preset.videoCodec,
        '-b:v', `${preset.videoBitrateKbps}k`,
        '-c:a', preset.audioCodec,
        '-b:a', `${preset.audioBitrateKbps}k`,
        '-r', String(preset.frameRate),
        '-s', preset.resolution,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', // web-optimized MP4
        '-y', // overwrite output
        outputPath,
    ];
}