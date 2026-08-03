/**
 * Suro-Buya Engine v2 - Prompt Builder (VF-2.5)
 *
 * Build visual dan motion prompt per shot untuk image/video generator.
 * Menggabungkan ShotSpec (VF-2.5 scene-breakdown) dengan CharacterVisualProfile
 * (VF-1.1) untuk menghasilkan prompt siap pakai yang menjaga konsistensi
 * visual karakter.
 *
 * Output prompt dikonsumsi oleh:
 * - visual/image-generator.ts (VF-3) untuk generate keyframe image
 * - motion/animation-generator.ts (VF-3) untuk generate video clip
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan scene-breakdown.ts.
 */

import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';

/**
 * Input untuk prompt builder.
 */
export interface PromptBuilderInput {
  /** Shot yang akan dibangun prompt-nya */
  shot: ShotSpec;

  /** Visual profile karakter — dari CharacterAsset (VF-1.1) */
  visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;

  /** Gaya visual opsional, mis. "2D digital, watercolor" */
  artStyle?: string;
}

/**
 * Hasil prompt builder.
 */
export interface PromptBuilderResult {
  /** Prompt siap pakai untuk image generator */
  visualPrompt: string;

  /** Prompt siap pakai untuk motion/video generator */
  motionPrompt: string;

  /** Negative prompt — hal yang harus dihindari */
  negativePrompt: string;
}

/**
 * Default art style kalau tidak disuplai.
 */
const DEFAULT_ART_STYLE = '2D digital illustration, vibrant colors, clean lines, high quality';

/**
 * Build visual prompt untuk image generator.
 *
 * Menggabungkan:
 * 1. Shot action (apa yang terjadi)
 * 2. Camera angle (sudut kamera)
 * 3. Character visual description (dari CharacterVisualProfile)
 * 4. Art style
 * 5. Reference image conditioning hint
 */
export function buildVisualPrompt(input: PromptBuilderInput): string {
  const { shot, visualProfile, artStyle } = input;

  const parts: string[] = [];

  // 1. Camera angle
  parts.push(shot.cameraAngle);

  // 2. Action description
  parts.push(shot.action);

  // 3. Character visual profile
  if (visualProfile) {
    if (visualProfile.styleTags && visualProfile.styleTags.length > 0) {
      parts.push(`Style: ${visualProfile.styleTags.join(', ')}`);
    }
    if (visualProfile.colorPalette && visualProfile.colorPalette.length > 0) {
      parts.push(`Color palette: ${visualProfile.colorPalette.join(', ')}`);
    }
  }

  // 4. Art style
  parts.push(`Art style: ${artStyle || DEFAULT_ART_STYLE}`);

  // 5. Reference image conditioning hint
  if (visualProfile && visualProfile.referenceImages && visualProfile.referenceImages.length > 0) {
    parts.push(`Use character reference image for consistency. ${visualProfile.referenceImages.length} reference images available.`);
  }

  // 6. Vertical 9:16 format
  parts.push('Vertical 9:16 format, optimized for short-form video');

  return parts.join('. ');
}

/**
 * Build motion prompt untuk video/motion generator.
 *
 * Menggabungkan:
 * 1. Shot motionPrompt (kalau ada) atau default berdasarkan camera angle
 * 2. Duration hint
 * 3. Camera movement suggestion
 */
export function buildMotionPrompt(input: PromptBuilderInput): string {
  const { shot } = input;

  if (shot.motionPrompt) {
    return `${shot.motionPrompt}. Duration: ${shot.duration}s. Camera: ${shot.cameraAngle}.`;
  }

  // Default motion berdasarkan camera angle
  const motionDefaults: Record<string, string> = {
    'close-up': 'subtle character movement, slight camera drift',
    'extreme close-up': 'minimal movement, focus on facial expression',
    'medium shot': 'character body language visible, gentle camera sway',
    'wide shot': 'environmental movement, slow pan',
    'over-the-shoulder': 'conversation pacing, slight nod movement',
  };

  const defaultMotion = motionDefaults[shot.cameraAngle] || 'gentle character movement, stable camera';
  return `${defaultMotion}. Duration: ${shot.duration}s. Camera: ${shot.cameraAngle}.`;
}

/**
 * Build negative prompt — hal yang harus dihindari image generator.
 */
export function buildNegativePrompt(input: PromptBuilderInput): string {
  const { visualProfile } = input;

  const negatives: string[] = [
    'blurry',
    'low quality',
    'distorted',
    'extra limbs',
    'deformed',
    'watermark',
    'text overlay',
    'horizontal format',
  ];

  if (visualProfile?.negativePrompt) {
    negatives.push(visualProfile.negativePrompt);
  }

  return negatives.join(', ');
}

/**
 * Build semua prompt (visual + motion + negative) sekaligus.
 */
export function buildAllPrompts(input: PromptBuilderInput): PromptBuilderResult {
  return {
    visualPrompt: buildVisualPrompt(input),
    motionPrompt: buildMotionPrompt(input),
    negativePrompt: buildNegativePrompt(input),
  };
}