/**
 * Suro-Buya Video Renderer — Main Entry Point (VF-4.4/VF-4.5)
 *
 * Package ini berisi:
 * - Remotion composition (VF-4.4): video + audio + subtitle track
 * - FFmpeg encoder (VF-4.5): encode sesuai spec platform
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md:
 * - VF-4.4: "Setup packages/video-renderer (Remotion) — Composition dasar"
 * - VF-4.5: "compose/timeline-builder.ts + platform-preset.ts + FFmpeg encode"
 *
 * Dan REDESIGN-VIDEO-FACTORY.md §4:
 * "Remotion + FFmpeg — Type-safe, programmatic"
 */

// VF-4.4 — Remotion composition (video + audio + subtitle)
export { VideoComposition, buildCompositionProps, type VideoCompositionProps } from './composition.js';
export { default as VideoCompositionDefault } from './composition.js';

// VF-4.5 — FFmpeg encoder
export {
    encodeVideo,
    generateThumbnail,
    isFFmpegAvailable,
    FFmpegEncoderError,
    type FFmpegEncodeResult,
} from './codecs/ffmpeg-encoder.js';

/**
 * Package version
 */
export const VERSION = '0.1.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
    name: '@suro-buya/video-renderer',
    version: VERSION,
    description: 'Suro-Buya Video Renderer — Remotion composition + FFmpeg encode',
} as const;