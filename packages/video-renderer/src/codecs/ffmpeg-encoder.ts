/**
 * Suro-Buya Video Renderer — FFmpeg Encoder (VF-4.5)
 *
 * FFmpeg encode untuk video final. Mengambil raw video dari Remotion render
 * dan encode sesuai spec platform (resolusi, codec, bitrate, safe zone).
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-4.5:
 * "Assemble timeline, encode sesuai spec platform"
 *
 * Dan VF-4 Acceptance Criteria #4:
 * "Output memenuhi spesifikasi platform (1080x1920, safe zone, codec)"
 *
 * FFmpeg dipanggil via child_process — bukan library npm — supaya
 * tidak menambah dependency dan lebih fleksibel. FFmpeg harus ter-install
 * di sistem (Docker image / server).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PlatformPreset } from '@suro-buya/engine-v2';
import { buildFFmpegArgs } from '@suro-buya/engine-v2';

const execFileAsync = promisify(execFile);

/**
 * Hasil encode FFmpeg.
 */
export interface FFmpegEncodeResult {
    /** Path file output (encoded MP4) */
    outputPath: string;

    /** Durasi video dalam detik */
    duration: number;

    /** Resolusi output, mis. "1080x1920" */
    resolution: string;

    /** Platform target */
    platform: string;

    /** Ukuran file dalam bytes */
    fileSizeBytes: number;
}

/**
 * Error yang dilempar saat FFmpeg encode gagal.
 */
export class FFmpegEncoderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FFmpegEncoderError';
    }
}

/**
 * Encode video dengan FFmpeg sesuai platform preset.
 *
 * @param preset Platform preset (dari VF-4.5 platform-preset)
 * @param inputPath Path file input (raw video dari Remotion render)
 * @param outputPath Path file output (encoded MP4)
 * @returns Encode result dengan metadata
 *
 * @throws FFmpegEncoderError kalau FFmpeg gagal atau tidak ditemukan
 */
export async function encodeVideo(
    preset: PlatformPreset,
    inputPath: string,
    outputPath: string,
): Promise<FFmpegEncodeResult> {
    const args = buildFFmpegArgs(preset, inputPath, outputPath);

    try {
        const { stdout, stderr } = await execFileAsync('ffmpeg', args, {
            timeout: 300000, // 5 menit timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        // FFmpeg writes progress to stderr — check for errors
        if (stderr && stderr.includes('Error')) {
            throw new FFmpegEncoderError(
                `FFmpeg encoding error: ${stderr}`,
            );
        }

        // Get file size
        const fs = await import('node:fs/promises');
        const stats = await fs.stat(outputPath);
        const fileSizeBytes = stats.size;

        return {
            outputPath,
            duration: 0, // Will be filled by caller from timeline
            resolution: preset.resolution,
            platform: preset.platform,
            fileSizeBytes,
        };
    } catch (err) {
        if (err instanceof FFmpegEncoderError) {
            throw err;
        }

        const message = err instanceof Error ? err.message : String(err);

        // Check if FFmpeg is not installed
        if (message.includes('not found') || message.includes('ENOENT')) {
            throw new FFmpegEncoderError(
                'FFmpeg not found — install FFmpeg in the system/Docker image to enable video encoding.',
            );
        }

        throw new FFmpegEncoderError(
            `FFmpeg encode failed: ${message}`,
        );
    }
}

/**
 * Generate thumbnail dari video.
 *
 * Mengambil frame pertama dari video sebagai thumbnail.
 *
 * @param inputPath Path file video input
 * @param outputPath Path file thumbnail output (PNG/JPG)
 * @param timeOffset Offset waktu dalam detik (default: 0 — frame pertama)
 */
export async function generateThumbnail(
    inputPath: string,
    outputPath: string,
    timeOffset: number = 0,
): Promise<{ outputPath: string; fileSizeBytes: number }> {
    const args = [
        '-i', inputPath,
        '-ss', String(timeOffset),
        '-frames:v', '1',
        '-q:v', '2', // high quality
        '-y',
        outputPath,
    ];

    try {
        await execFileAsync('ffmpeg', args, {
            timeout: 60000, // 1 menit timeout
            maxBuffer: 10 * 1024 * 1024,
        });

        const fs = await import('node:fs/promises');
        const stats = await fs.stat(outputPath);

        return {
            outputPath,
            fileSizeBytes: stats.size,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new FFmpegEncoderError(
            `Thumbnail generation failed: ${message}`,
        );
    }
}

/**
 * Cek apakah FFmpeg tersedia di sistem.
 */
export async function isFFmpegAvailable(): Promise<boolean> {
    try {
        await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}