/**
 * Suro-Buya Engine v2 - Style Guide Enforcer (VF-3.2)
 *
 * Validasi konsistensi gaya visual lintas shot dalam satu video.
 * Memastikan bahwa SEMUA shot menggunakan parameter visual yang sama
 * (reference images, style tags, color palette, negative prompt) — ini
 * mekanisme utama yang menjaga karakter terlihat konsisten visual di
 * seluruh shot (VF-3 Acceptance Criteria #1).
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan scene-breakdown.ts (VF-2.5)
 * dan beat-sheet.ts (VF-2.3).
 */

import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';

/** Severity violation — error menghentikan generate, warning hanya informasi */
export type ViolationSeverity = 'error' | 'warning';

/** Satu pelanggaran style guide untuk satu shot */
export interface StyleGuideViolation {
    shotIndex: number;
    field: string;
    message: string;
    severity: ViolationSeverity;
}

/** Hasil enforcement style guide */
export interface StyleGuideEnforcementResult {
    /** true kalau tidak ada error severity violation (warning masih boleh) */
    passed: boolean;
    violations: StyleGuideViolation[];
    /** Saran untuk meningkatkan konsistensi (bukan violation, cuma rekomendasi) */
    recommendations: string[];
    /** Ringkasan style guide yang dipakai — untuk debugging/logging */
    styleSummary: string;
}

/**
 * Build ringkasan style guide dari visual profile — dipakai untuk
 * debugging/logging dan dimasukkan ke prompt untuk enforce consistency.
 */
export function buildStyleSummary(
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>,
): string {
    if (!visualProfile) {
        return 'No visual profile — style guide not enforced.';
    }

    const parts: string[] = [];

    if (visualProfile.referenceImages && visualProfile.referenceImages.length > 0) {
        parts.push(`${visualProfile.referenceImages.length} reference images`);
    }

    if (visualProfile.styleTags && visualProfile.styleTags.length > 0) {
        parts.push(`style: ${visualProfile.styleTags.join(', ')}`);
    }

    if (visualProfile.colorPalette && visualProfile.colorPalette.length > 0) {
        parts.push(`palette: ${visualProfile.colorPalette.join(', ')}`);
    }

    if (visualProfile.negativePrompt) {
        parts.push(`negative: ${visualProfile.negativePrompt.slice(0, 50)}...`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Visual profile present but empty.';
}

/**
 * Enforce style guide untuk storyboard.
 *
 * Cek yang dilakukan:
 * 1. Visual profile present — kalau tidak ada, warning (konsistensi tidak bisa di-enforce)
 * 2. Reference images present — kalau tidak ada, warning (karakter consistency mechanism missing)
 * 3. Style tags present — kalau tidak ada, warning (visual style consistency missing)
 * 4. Setiap shot punya visualPrompt non-empty — error kalau kosong
 * 5. Setiap shot punya cameraAngle non-empty — error kalau kosong
 * 6. Setiap shot punya duration positive — error kalau <= 0
 *
 * @param shots Shot list dari storyboard (VF-2.5)
 * @param visualProfile Visual DNA karakter dari CharacterAsset (VF-1.1)
 * @returns Enforcement result — passed=true kalau tidak ada error
 */
export function enforceStyleGuide(
    shots: ShotSpec[],
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>,
): StyleGuideEnforcementResult {
    const violations: StyleGuideViolation[] = [];
    const recommendations: string[] = [];

    // --- Check 1: Visual profile present ---
    if (!visualProfile) {
        recommendations.push(
            'No visual profile provided — character visual consistency cannot be enforced. ' +
            'Generate reference images first (VF-1.6) and save to CharacterAsset.',
        );
    } else {
        // --- Check 2: Reference images present ---
        if (
            !visualProfile.referenceImages ||
            visualProfile.referenceImages.length === 0
        ) {
            recommendations.push(
                'No reference images in visual profile — character consistency relies on ' +
                'reference-image conditioning (REDESIGN-VIDEO-FACTORY.md §4). ' +
                'Without it, character may look different across shots.',
            );
        }

        // --- Check 3: Style tags present ---
        if (
            !visualProfile.styleTags ||
            visualProfile.styleTags.length === 0
        ) {
            recommendations.push(
                'No style tags in visual profile — visual style consistency ' +
                '(e.g., "2D", "watercolor") cannot be enforced.',
            );
        }

        // --- Check 3b: Color palette present (optional but recommended) ---
        if (
            !visualProfile.colorPalette ||
            visualProfile.colorPalette.length === 0
        ) {
            recommendations.push(
                'No color palette in visual profile — color consistency ' +
                'across shots may vary. Consider defining a palette.',
            );
        }
    }

    // --- Check 4: Each shot has non-empty visualPrompt ---
    for (const shot of shots) {
        if (!shot.visualPrompt || shot.visualPrompt.trim().length === 0) {
            violations.push({
                shotIndex: shot.index,
                field: 'visualPrompt',
                message:
                    'Visual prompt is empty — cannot generate keyframe without a prompt.',
                severity: 'error',
            });
        }
    }

    // --- Check 5: Each shot has non-empty cameraAngle ---
    for (const shot of shots) {
        if (!shot.cameraAngle || shot.cameraAngle.trim().length === 0) {
            violations.push({
                shotIndex: shot.index,
                field: 'cameraAngle',
                message:
                    'Camera angle is empty — cannot determine shot composition.',
                severity: 'error',
            });
        }
    }

    // --- Check 6: Each shot has positive duration ---
    for (const shot of shots) {
        if (shot.duration <= 0) {
            violations.push({
                shotIndex: shot.index,
                field: 'duration',
                message: `Duration must be positive, got ${shot.duration}.`,
                severity: 'error',
            });
        }
    }

    // --- Check 7: Multi-shot consistency emphasis ---
    if (shots.length >= 8 && (!visualProfile || !visualProfile.referenceImages?.length)) {
        recommendations.push(
            `High shot count (${shots.length}) without reference images — ` +
            'character consistency is at high risk. ' +
            'VF-3 Acceptance Criteria requires 8-shot sequence consistency.',
        );
    }

    const errors = violations.filter((v) => v.severity === 'error');
    const passed = errors.length === 0;

    return {
        passed,
        violations,
        recommendations,
        styleSummary: buildStyleSummary(visualProfile),
    };
}

/**
 * Validasi bahwa dua visual profile konsisten (dipakai untuk lintas-episode check).
 * Membandingkan reference images, style tags, color palette, dan negative prompt.
 *
 * Dipakai untuk VF-3 Acceptance Criteria #2: "Karakter yang sama juga terlihat
 * konsisten lintas video/episode berbeda" — pastikan episode 1 dan episode 2
 * pakai reference image yang identik.
 */
export interface CrossEpisodeConsistencyResult {
    consistent: boolean;
    differences: string[];
}

export function checkCrossEpisodeConsistency(
    profile1?: Omit<CharacterVisualProfile, 'characterId'>,
    profile2?: Omit<CharacterVisualProfile, 'characterId'>,
): CrossEpisodeConsistencyResult {
    const differences: string[] = [];

    if (!profile1 || !profile2) {
        return {
            consistent: false,
            differences: ['One or both visual profiles are missing.'],
        };
    }

    // Compare reference images
    const refs1 = profile1.referenceImages ?? [];
    const refs2 = profile2.referenceImages ?? [];
    if (refs1.length !== refs2.length) {
        differences.push(
            `Reference image count differs: ${refs1.length} vs ${refs2.length}.`,
        );
    } else {
        const refs1Set = new Set(refs1);
        const refs2Set = new Set(refs2);
        const intersection = [...refs1Set].filter((r) => refs2Set.has(r));
        if (intersection.length !== refs1.length) {
            differences.push(
                `Reference images are not identical — only ${intersection.length} of ${refs1.length} match.`,
            );
        }
    }

    // Compare style tags
    const tags1 = profile1.styleTags ?? [];
    const tags2 = profile2.styleTags ?? [];
    if (tags1.join(',') !== tags2.join(',')) {
        differences.push(
            `Style tags differ: [${tags1.join(', ')}] vs [${tags2.join(', ')}].`,
        );
    }

    // Compare color palette
    const palette1 = profile1.colorPalette ?? [];
    const palette2 = profile2.colorPalette ?? [];
    if (palette1.join(',') !== palette2.join(',')) {
        differences.push(
            `Color palette differs: [${palette1.join(', ')}] vs [${palette2.join(', ')}].`,
        );
    }

    // Compare negative prompt
    const neg1 = profile1.negativePrompt ?? '';
    const neg2 = profile2.negativePrompt ?? '';
    if (neg1 !== neg2) {
        differences.push('Negative prompt differs between profiles.');
    }

    return {
        consistent: differences.length === 0,
        differences,
    };
}