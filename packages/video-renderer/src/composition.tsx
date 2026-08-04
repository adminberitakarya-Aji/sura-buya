/**
 * Suro-Buya Video Renderer — Remotion Composition (VF-4.4)
 *
 * Composition dasar: video + audio + subtitle track. Menggunakan Remotion
 * untuk programmatic video composition — type-safe, React-based.
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-4.4:
 * "Composition dasar: video + audio + subtitle track"
 *
 * Dan REDESIGN-VIDEO-FACTORY.md §4:
 * "Remotion + FFmpeg — Type-safe, programmatic"
 *
 * Composition ini menerima VideoTimeline (dari VF-4.5 timeline-builder)
 * dan render setiap frame sebagai React component. Remotion meng-handle
 * timing, audio mixing, dan subtitle sync secara declarative.
 */

import React from 'react';
import type { VideoTimeline } from '@suro-buya/engine-v2';

/**
 * Props untuk VideoComposition — Remotion component utama.
 */
export interface VideoCompositionProps {
    /** Timeline dari VF-4.5 timeline-builder */
    timeline: VideoTimeline;
}

/**
 * Video Composition — Remotion component utama.
 *
 * Render video clips, audio tracks (voiceover + SFX + BGM), dan subtitle
 * track dalam satu composition 9:16 vertical.
 *
 * Setiap track di-render sebagai React component dengan timing yang
 * diatur oleh Remotion's <Sequence> dan <Audio> components.
 */
export const VideoComposition: React.FC<VideoCompositionProps> = ({ timeline }) => {
    const fps = timeline.preset.frameRate;

    return (
        <div
            style={{
                width: timeline.preset.width,
                height: timeline.preset.height,
                backgroundColor: '#000000',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Video Track — urutan clip */}
            {timeline.videoTrack.map((entry, i) => (
                <VideoClipSequence
                    key={`video-${i}`}
                    entry={entry}
                    fps={fps}
                />
            ))}

            {/* Audio Track — voiceover, SFX, BGM */}
            {timeline.audioTrack.map((entry, i) => (
                <AudioEntry
                    key={`audio-${i}`}
                    entry={entry}
                    fps={fps}
                />
            ))}

            {/* Subtitle Track */}
            {timeline.subtitleTrack.map((entry, i) => (
                <SubtitleEntry
                    key={`subtitle-${i}`}
                    entry={entry}
                    fps={fps}
                    preset={timeline.preset}
                />
            ))}
        </div>
    );
};

/**
 * Satu video clip sequence — render video di waktu yang tepat.
 *
 * NOTE: Dalam implementasi Remotion nyata, ini akan menggunakan
 * <Sequence> dan <Video> dari 'remotion'. Di sini kita pakai
 * placeholder div karena Remotion tidak di-install sebagai dependency
 * (akan di-install saat production render di-setup).
 */
const VideoClipSequence: React.FC<{
    entry: VideoTimeline['videoTrack'][0];
    fps: number;
}> = ({ entry }) => {
    const startFrame = Math.round(entry.startTime * 30); // 30fps default
    const durationFrames = Math.round(entry.duration * 30);

    return (
        <div
            data-start-frame={startFrame}
            data-duration-frames={durationFrames}
            data-clip-url={entry.clipUrl}
            data-shot-index={entry.shotIndex}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
            }}
        >
            {/* Remotion <Video> akan dirender di sini saat production */}
        </div>
    );
};

/**
 * Satu audio entry — render audio di waktu yang tepat dengan volume.
 */
const AudioEntry: React.FC<{
    entry: VideoTimeline['audioTrack'][0];
    fps: number;
}> = ({ entry }) => {
    const startFrame = Math.round(entry.startTime * 30);
    const durationFrames = Math.round(entry.duration * 30);

    return (
        <div
            data-start-frame={startFrame}
            data-duration-frames={durationFrames}
            data-audio-url={entry.audioUrl}
            data-audio-type={entry.type}
            data-volume={entry.volume}
            data-shot-index={entry.shotIndex}
            style={{ display: 'none' }}
        >
            {/* Remotion <Audio> akan dirender di sini saat production */}
        </div>
    );
};

/**
 * Satu subtitle entry — render subtitle text di waktu yang tepat.
 */
const SubtitleEntry: React.FC<{
    entry: VideoTimeline['subtitleTrack'][0];
    fps: number;
    preset: VideoTimeline['preset'];
}> = ({ entry, preset }) => {
    const startFrame = Math.round(entry.startTime * 30);
    const durationFrames = Math.round((entry.endTime - entry.startTime) * 30);

    // Safe zone — subtitle ditempatkan di bawah tapi di atas safe zone bottom
    const safeBottom = Math.round(
        (preset.safeZoneMarginPercent.bottom / 100) * preset.height,
    );
    const subtitleY = preset.height - safeBottom - 80; // 80px di atas safe zone bottom

    return (
        <div
            data-start-frame={startFrame}
            data-duration-frames={durationFrames}
            data-subtitle-text={entry.text}
            style={{
                position: 'absolute',
                bottom: `${preset.height - subtitleY}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: '80%',
                padding: '8px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: 600,
                textAlign: 'center',
                borderRadius: '8px',
                pointerEvents: 'none',
            }}
        >
            {entry.text}
        </div>
    );
};

/**
 * Build Remotion composition props dari VideoTimeline.
 *
 * Helper untuk caller (video-worker atau API route) yang sudah punya
 * VideoTimeline dan mau render video via Remotion.
 */
export function buildCompositionProps(timeline: VideoTimeline): VideoCompositionProps {
    return { timeline };
}

/**
 * Default export — VideoComposition component.
 */
export default VideoComposition;