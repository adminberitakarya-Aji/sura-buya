/**
 * Suro-Buya Engine v2 - Timeline Builder (VF-4.5)
 *
 * Assemble timeline dari video clips (VF-3.4), voiceovers (VF-4.3),
 * SFX (VF-4.3), dan BGM (VF-4.3) menjadi struktur siap render.
 *
 * Timeline adalah representasi data dari video final — bukan file MP4
 * (itu dihasilkan oleh packages/video-renderer via Remotion + FFmpeg,
 * lihat VF-4.4/VF-4.5). Timeline berisi: urutan clip, audio track
 * (voiceover + SFX + BGM), subtitle track, dan metadata.
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-4.5:
 * "Assemble timeline, encode sesuai spec platform"
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database, tidak render video. Pola yang sama dengan
 * platform-preset.ts (VF-4.5).
 */

import type { ShotSpec, PlatformTarget } from '@suro-buya/shared';
import type { GeneratedClip } from '../motion/animation-generator.js';
import type { GeneratedVoiceover } from '../audio/voiceover-generator.js';
import type { SelectedSfx } from '../audio/sfx-selector.js';
import type { MusicSelectionResult } from '../audio/music-selector.js';
import type { PlatformPreset } from './platform-preset.js';
import { getPlatformPreset, isDurationWithinLimit } from './platform-preset.js';

/**
 * Satu entry di video timeline (satu shot).
 */
export interface TimelineVideoEntry {
    /** Index shot dalam storyboard */
    shotIndex: number;

    /** URL video clip (dari VF-3.4) */
    clipUrl: string;

    /** Start time dalam timeline (detik) */
    startTime: number;

    /** Durasi clip dalam detik */
    duration: number;

    /** End time dalam timeline (detik) */
    endTime: number;
}

/**
 * Satu entry di audio timeline (voiceover).
 */
export interface TimelineAudioEntry {
    /** Index shot yang punya voiceover ini */
    shotIndex: number;

    /** URL audio (dari VF-4.3) */
    audioUrl: string;

    /** Start time dalam timeline (detik) — sync ke shot start */
    startTime: number;

    /** Durasi audio dalam detik */
    duration: number;

    /** Tipe audio: voiceover, sfx, music */
    type: 'voiceover' | 'sfx' | 'music';

    /** Volume (0-1) */
    volume: number;
}

/**
 * Satu entry di subtitle track.
 */
export interface TimelineSubtitleEntry {
    /** Index shot */
    shotIndex: number;

    /** Teks subtitle (dari ShotSpec.dialogue.line) */
    text: string;

    /** Start time dalam timeline (detik) */
    startTime: number;

    /** End time dalam timeline (detik) */
    endTime: number;
}

/**
 * Timeline lengkap untuk video final.
 */
export interface VideoTimeline {
    /** Video track — urutan clip */
    videoTrack: TimelineVideoEntry[];

    /** Audio track — voiceover, SFX, BGM */
    audioTrack: TimelineAudioEntry[];

    /** Subtitle track — dialog text */
    subtitleTrack: TimelineSubtitleEntry[];

    /** Total durasi video dalam detik */
    totalDuration: number;

    /** Platform targets */
    platforms: PlatformTarget[];

    /** Platform preset yang dipakai */
    preset: PlatformPreset;

    /** Warning dari proses assembly */
    warnings: string[];
}

/**
 * Input untuk build timeline.
 */
export interface TimelineBuilderInput {
    /** Shot list dari storyboard (VF-2.5) */
    shots: ShotSpec[];

    /** Video clips dari VF-3.4 (animation-generator) */
    clips: GeneratedClip[];

    /** Voiceovers dari VF-4.3 (voiceover-generator) */
    voiceovers: GeneratedVoiceover[];

    /** SFX selections dari VF-4.3 (sfx-selector) */
    sfxSelections: SelectedSfx[];

    /** Music selection dari VF-4.3 (music-selector) */
    music: MusicSelectionResult;

    /** Platform targets */
    platforms: PlatformTarget[];

    /** Volume BGM (0-1, default: 0.3 — BGM tidak boleh mendominasi voiceover) */
    bgmVolume?: number;

    /** Volume voiceover (0-1, default: 1.0) */
    voiceoverVolume?: number;

    /** Volume SFX (0-1, default: 0.5) */
    sfxVolume?: number;
}

/**
 * Error yang dilempar saat build timeline gagal.
 */
export class TimelineBuilderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimelineBuilderError';
    }
}

/**
 * Build video timeline dari clips, voiceovers, SFX, dan BGM.
 *
 * Alur:
 * 1. Validasi input (shots tidak kosong, clips match shots)
 * 2. Hitung start time per shot (kumulatif dari duration)
 * 3. Build video track (urutan clip dengan timing)
 * 4. Build audio track (voiceover sync ke shot, SFX sync ke shot, BGM full duration)
 * 5. Build subtitle track (dialogue text sync ke shot)
 * 6. Validasi total duration terhadap platform limit
 *
 * @param input Shots + clips + voiceovers + SFX + music + platforms
 * @returns Video timeline siap render
 */
export function buildTimeline(input: TimelineBuilderInput): VideoTimeline {
    // --- Validate input ---
    if (!input.shots || input.shots.length === 0) {
        throw new TimelineBuilderError(
            'Cannot build timeline: shots list is empty. Generate storyboard first (VF-2.5).',
        );
    }

    if (input.clips.length === 0) {
        throw new TimelineBuilderError(
            'Cannot build timeline: clips list is empty. Generate video clips first (VF-3.4).',
        );
    }

    if (input.shots.length !== input.clips.length) {
        throw new TimelineBuilderError(
            `Shot count (${input.shots.length}) does not match clip count (${input.clips.length}). ` +
                'Both must be generated from the same storyboard.',
        );
    }

    const warnings: string[] = [];

    // --- Get platform preset (use first platform for resolution/codec) ---
    const primaryPlatform = input.platforms[0] ?? 'TIKTOK';
    const preset = getPlatformPreset(primaryPlatform);

    // --- Build clip lookup map ---
    const clipMap = new Map(input.clips.map((c) => [c.shotIndex, c]));

    // --- Calculate start times (cumulative) ---
    let currentTime = 0;
    const shotTimings = new Map<number, { startTime: number; duration: number; endTime: number }>();

    for (const shot of input.shots) {
        const clip = clipMap.get(shot.index);
        const duration = clip?.durationActual ?? shot.duration;

        shotTimings.set(shot.index, {
            startTime: currentTime,
            duration,
            endTime: currentTime + duration,
        });

        currentTime += duration;
    }

    const totalDuration = currentTime;

    // --- Build video track ---
    const videoTrack: TimelineVideoEntry[] = input.shots.map((shot) => {
        const timing = shotTimings.get(shot.index)!;
        const clip = clipMap.get(shot.index);
        return {
            shotIndex: shot.index,
            clipUrl: clip?.clipUrl ?? '',
            startTime: timing.startTime,
            duration: timing.duration,
            endTime: timing.endTime,
        };
    });

    // --- Build audio track ---
    const audioTrack: TimelineAudioEntry[] = [];
    const voiceoverVolume = input.voiceoverVolume ?? 1.0;
    const sfxVolume = input.sfxVolume ?? 0.5;
    const bgmVolume = input.bgmVolume ?? 0.3;

    // Voiceovers — sync to shot start
    const voiceoverMap = new Map(input.voiceovers.map((v) => [v.shotIndex, v]));
    for (const shot of input.shots) {
        const timing = shotTimings.get(shot.index)!;
        const voiceover = voiceoverMap.get(shot.index);

        if (voiceover) {
            audioTrack.push({
                shotIndex: shot.index,
                audioUrl: voiceover.audioUrl,
                startTime: timing.startTime,
                duration: voiceover.durationActual,
                type: 'voiceover',
                volume: voiceoverVolume,
            });
        }
    }

    // SFX — sync to shot start
    const sfxMap = new Map(input.sfxSelections.map((s) => [s.shotIndex, s]));
    for (const shot of input.shots) {
        const timing = shotTimings.get(shot.index)!;
        const sfxSelection = sfxMap.get(shot.index);

        if (sfxSelection) {
            for (const sfx of sfxSelection.sfx) {
                audioTrack.push({
                    shotIndex: shot.index,
                    audioUrl: sfx.url,
                    startTime: timing.startTime,
                    duration: sfx.duration,
                    type: 'sfx',
                    volume: sfxVolume,
                });
            }
        }
    }

    // BGM — full duration
    if (input.music.primaryTrack) {
        audioTrack.push({
            shotIndex: -1, // BGM spans entire video
            audioUrl: input.music.primaryTrack.url,
            startTime: 0,
            duration: totalDuration,
            type: 'music',
            volume: bgmVolume,
        });
    } else {
        warnings.push('No BGM track selected — video will have no background music.');
    }

    // --- Build subtitle track ---
    const subtitleTrack: TimelineSubtitleEntry[] = [];
    for (const shot of input.shots) {
        if (shot.dialogue) {
            const timing = shotTimings.get(shot.index)!;
            subtitleTrack.push({
                shotIndex: shot.index,
                text: shot.dialogue.line,
                startTime: timing.startTime,
                endTime: timing.endTime,
            });
        }
    }

    // --- Validate duration against platform limits ---
    for (const platform of input.platforms) {
        if (!isDurationWithinLimit(totalDuration, platform)) {
            const platformPreset = getPlatformPreset(platform);
            warnings.push(
                `Video duration (${totalDuration}s) exceeds ${platform} limit (${platformPreset.maxDurationSec}s).`,
            );
        }
    }

    // --- Warning for missing clips ---
    const missingClips = videoTrack.filter((v) => !v.clipUrl);
    if (missingClips.length > 0) {
        warnings.push(
            `${missingClips.length} shot(s) have no video clip URL — these will show as blank in the final video.`,
        );
    }

    return {
        videoTrack,
        audioTrack,
        subtitleTrack,
        totalDuration,
        platforms: input.platforms,
        preset,
        warnings,
    };
}