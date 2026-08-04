/**
 * Suro-Buya Engine v2 - Camera Motion Presets (VF-3.4)
 *
 * Preset pan/zoom untuk cost optimization. Kalau ShotSpec.motionPrompt tidak
 * di-set, animation-generator pakai preset berdasarkan cameraAngle — preset
 * yang lebih sederhana (static, slow-zoom) lebih murah di provider video gen
 * karena butuh less compute (REDESIGN-VIDEO-FACTORY.md §10: "Cost membengkak
 * di volume tinggi" → cost optimization via preset matching).
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan style-guide-enforcer.ts (VF-3.2)
 * dan beat-sheet.ts (VF-2.3).
 */

/** Preset gerak kamera — menentukan kompleksitas (dan biaya) video generation */
export type CameraMotionPreset =
    | 'static'           // tidak ada gerakan kamera, hanya karakter bergerak (paling murah)
    | 'slow-zoom-in'     // zoom perlahan mendekat (murah)
    | 'slow-zoom-out'    // zoom perlahan menjauh (murah)
    | 'pan-left'         // geser kamera ke kiri (sedang)
    | 'pan-right'        // geser kamera ke kanan (sedang)
    | 'tilt-up'          // tilt kamera ke atas (sedang)
    | 'tilt-down'        // tilt kamera ke bawah (sedang)
    | 'gentle-sway'      // goyangan kamera halus (sedang)
    | 'dynamic'          // gerakan kamera dinamis kompleks (paling mahal)
    | 'handheld';        // simulasi kamera genggam (sedang)

/** Tier biaya — dipakai untuk cost optimization (preset sederhana → provider lebih murah) */
export type MotionCostTier = 'low' | 'medium' | 'high';

/**
 * Mapping camera angle → default motion preset.
 * Dipakai kalau ShotSpec.motionPrompt tidak di-set (opsional).
 */
const CAMERA_MOTION_DEFAULTS: Record<string, CameraMotionPreset> = {
    'close-up': 'slow-zoom-in',
    'extreme close-up': 'static',
    'medium shot': 'gentle-sway',
    'wide shot': 'pan-right',
    'over-the-shoulder': 'static',
    'establishing shot': 'slow-zoom-out',
    'two shot': 'gentle-sway',
    'point of view': 'handheld',
};

/**
 * Mapping preset → motion prompt text yang dipassing ke VideoProvider.
 * Text ini mengarahkan provider bagaimana menganimasikan keyframe.
 */
const PRESET_MOTION_PROMPTS: Record<CameraMotionPreset, string> = {
    'static': 'Minimal camera movement. Focus on subtle character animation and facial expressions. Stable framing.',
    'slow-zoom-in': 'Slow, smooth zoom in toward the subject. Steady pace, no sudden movements.',
    'slow-zoom-out': 'Slow, smooth zoom out from the subject. Reveal more of the environment gradually.',
    'pan-left': 'Smooth horizontal pan to the left. Steady speed, reveal new elements from the right.',
    'pan-right': 'Smooth horizontal pan to the right. Steady speed, reveal new elements from the left.',
    'tilt-up': 'Smooth vertical tilt upward. Reveal the subject from bottom to top.',
    'tilt-down': 'Smooth vertical tilt downward. Reveal the subject from top to bottom.',
    'gentle-sway': 'Gentle camera sway, slight floating movement. Natural handheld feel without shake.',
    'dynamic': 'Dynamic camera movement with purposeful motion. Can include combination of pan, zoom, and slight rotation for dramatic effect.',
    'handheld': 'Handheld camera feel with natural micro-movements. Slight shake for documentary style.',
};

/**
 * Mapping preset → cost tier.
 * low: preset sederhana yang butuh less compute (static, slow-zoom)
 * medium: preset dengan gerakan teratur (pan, tilt, sway)
 * high: preset kompleks yang butuh more compute (dynamic)
 */
const PRESET_COST_TIER: Record<CameraMotionPreset, MotionCostTier> = {
    'static': 'low',
    'slow-zoom-in': 'low',
    'slow-zoom-out': 'low',
    'pan-left': 'medium',
    'pan-right': 'medium',
    'tilt-up': 'medium',
    'tilt-down': 'medium',
    'gentle-sway': 'medium',
    'dynamic': 'high',
    'handheld': 'medium',
};

/**
 * Dapatkan default motion preset untuk camera angle tertentu.
 * Kalau camera angle tidak dikenal, return 'gentle-sway' (safe default).
 */
export function getDefaultMotionForAngle(cameraAngle: string): CameraMotionPreset {
    // Normalize: lowercase, trim
    const normalized = cameraAngle.toLowerCase().trim();
    return CAMERA_MOTION_DEFAULTS[normalized] ?? 'gentle-sway';
}

/**
 * Build motion prompt text dari preset.
 * @param preset Motion preset
 * @param duration Durasi shot dalam detik
 * @returns Motion prompt siap pakai untuk VideoProvider
 */
export function buildPresetMotion(preset: CameraMotionPreset, duration: number): string {
    const basePrompt = PRESET_MOTION_PROMPTS[preset];
    return `${basePrompt} Duration: ${duration}s.`;
}

/**
 * Dapatkan cost tier untuk preset.
 * Dipakai untuk cost optimization — preset 'low' bisa pakai provider
 * yang lebih murah atau durasi lebih pendek.
 */
export function getMotionCostTier(preset: CameraMotionPreset): MotionCostTier {
    return PRESET_COST_TIER[preset];
}

/**
 * Dapatkan semua preset yang tersedia (untuk debugging/UI).
 */
export function getAllMotionPresets(): CameraMotionPreset[] {
    return Object.keys(PRESET_MOTION_PROMPTS) as CameraMotionPreset[];
}

/**
 * Resolve motion prompt untuk shot.
 * Kalau ShotSpec.motionPrompt sudah di-set (custom), pakai itu.
 * Kalau tidak, pakai preset berdasarkan cameraAngle (cost optimization).
 *
 * @param motionPrompt Custom motion prompt dari ShotSpec (opsional)
 * @param cameraAngle Camera angle dari ShotSpec
 * @param duration Durasi shot dalam detik
 * @returns Object dengan motion prompt text, preset yang dipakai, dan cost tier
 */
export function resolveMotionPrompt(
    motionPrompt: string | undefined,
    cameraAngle: string,
    duration: number,
): {
    prompt: string;
    preset: CameraMotionPreset;
    costTier: MotionCostTier;
    isCustom: boolean;
} {
    // Kalau custom motion prompt di-set, pakai itu (mungkin lebih kompleks/expensive)
    if (motionPrompt && motionPrompt.trim().length > 0) {
        return {
            prompt: `${motionPrompt}. Duration: ${duration}s.`,
            preset: 'dynamic', // custom prompt → assume high cost
            costTier: 'high',
            isCustom: true,
        };
    }

    // Kalau tidak, pakai preset berdasarkan cameraAngle (cost optimization)
    const preset = getDefaultMotionForAngle(cameraAngle);
    return {
        prompt: buildPresetMotion(preset, duration),
        preset,
        costTier: getMotionCostTier(preset),
        isCustom: false,
    };
}