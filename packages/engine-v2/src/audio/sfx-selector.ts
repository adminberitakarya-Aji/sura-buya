/**
 * Suro-Buya Engine v2 - SFX Selector (VF-4.3)
 *
 * Pilih sound effect (SFX) per shot dari library. SFX dipilih berdasarkan
 * action description di ShotSpec — mis. "splashing water" → sfx "water_splash",
 * "footsteps on sand" → sfx "footstep_sand".
 *
 * Library SFX adalah katalog statis (bukan AI-generated) — dipetakan dari
 * keyword di action description ke URL SFX file. SFX file disimpan di
 * S3-compatible storage (R2/Tigris, lihat REDESIGN-VIDEO-FACTORY.md §4).
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan prompt-builder.ts (VF-2.5).
 */

import type { ShotSpec } from '@suro-buya/shared';

/**
 * Satu entry di SFX library.
 */
export interface SfxLibraryEntry {
    /** ID unik SFX, mis. "water_splash" */
    id: string;

    /** Keyword yang dipakai untuk match action description */
    keywords: string[];

    /** URL SFX file di storage */
    url: string;

    /** Durasi SFX dalam detik */
    duration: number;

    /** Kategori SFX, mis. "water", "footstep", "explosion" */
    category: string;
}

/**
 * SFX yang dipilih untuk satu shot.
 */
export interface SelectedSfx {
    /** Index shot dalam storyboard (ShotSpec.index) */
    shotIndex: number;

    /** SFX yang cocok untuk shot ini (bisa lebih dari satu) */
    sfx: SfxLibraryEntry[];

    /** Action description yang dipakai untuk matching */
    matchedAction: string;
}

/**
 * Hasil seleksi SFX untuk semua shot.
 */
export interface SfxSelectionResult {
    /** SFX per shot */
    selections: SelectedSfx[];

    /** Shot yang tidak punya SFX yang cocok (tidak error — tidak semua shot butuh SFX) */
    unmatchedShots: number[];

    /** Warning dari proses seleksi */
    warnings: string[];
}

/**
 * Default SFX library — katalog dasar untuk video pendek.
 *
 * Di production, library ini bisa diperluas dengan SFX tambahan dari
 * S3-compatible storage. URL di sini adalah placeholder — di production
 * diganti dengan URL R2/Tigris yang sebenarnya.
 */
export const DEFAULT_SFX_LIBRARY: SfxLibraryEntry[] = [
    // Water
    {
        id: 'water_splash',
        keywords: ['splash', 'water', 'air', 'splashing', 'berenang', 'laut', 'ombak'],
        url: 'https://sfx.suro-buya.local/water/splash.mp3',
        duration: 1.5,
        category: 'water',
    },
    {
        id: 'water_bubble',
        keywords: ['bubble', 'gelembung', 'bubbles', 'underwater', 'bawah laut'],
        url: 'https://sfx.suro-buya.local/water/bubble.mp3',
        duration: 2.0,
        category: 'water',
    },
    {
        id: 'ocean_wave',
        keywords: ['wave', 'ombak', 'ocean', 'sea', 'pasang', 'surf'],
        url: 'https://sfx.suro-buya.local/water/ocean_wave.mp3',
        duration: 5.0,
        category: 'water',
    },

    // Footsteps
    {
        id: 'footstep_sand',
        keywords: ['footstep', 'walk', 'walking', 'jalan', 'berjalan', 'sand', 'pasir', 'pantai'],
        url: 'https://sfx.suro-buya.local/footstep/sand.mp3',
        duration: 3.0,
        category: 'footstep',
    },
    {
        id: 'footstep_grass',
        keywords: ['footstep', 'walk', 'jalan', 'grass', 'rumput', 'padang'],
        url: 'https://sfx.suro-buya.local/footstep/grass.mp3',
        duration: 3.0,
        category: 'footstep',
    },

    // Emotion/Action
    {
        id: 'laugh',
        keywords: ['laugh', 'laughing', 'tertawa', 'ketawa', 'happy', 'senang'],
        url: 'https://sfx.suro-buya.local/emotion/laugh.mp3',
        duration: 2.0,
        category: 'emotion',
    },
    {
        id: 'gasp',
        keywords: ['gasp', 'surprised', 'kaget', 'terkejut', 'shock'],
        url: 'https://sfx.suro-buya.local/emotion/gasp.mp3',
        duration: 1.0,
        category: 'emotion',
    },
    {
        id: 'sigh',
        keywords: ['sigh', 'napas', 'menghela', 'sad', 'sedih'],
        url: 'https://sfx.suro-buya.local/emotion/sigh.mp3',
        duration: 1.5,
        category: 'emotion',
    },

    // Environment
    {
        id: 'wind_blow',
        keywords: ['wind', 'angin', 'breeze', 'blowing', 'berhembus'],
        url: 'https://sfx.suro-buya.local/environment/wind.mp3',
        duration: 5.0,
        category: 'environment',
    },
    {
        id: 'bird_chirp',
        keywords: ['bird', 'burung', 'chirp', 'tweet', 'kicau'],
        url: 'https://sfx.suro-buya.local/environment/bird.mp3',
        duration: 3.0,
        category: 'environment',
    },

    // Impact
    {
        id: 'thud',
        keywords: ['thud', 'fall', 'jatuh', 'drop', 'bump', 'benturan'],
        url: 'https://sfx.suro-buya.local/impact/thud.mp3',
        duration: 0.5,
        category: 'impact',
    },
    {
        id: 'crash',
        keywords: ['crash', 'smash', 'break', 'pecah', 'hancur', 'tabrakan'],
        url: 'https://sfx.suro-buya.local/impact/crash.mp3',
        duration: 1.5,
        category: 'impact',
    },

    // Magic/Sci-fi
    {
        id: 'magic_sparkle',
        keywords: ['magic', 'sihir', 'sparkle', 'kilau', 'glow', 'bersinar', 'cahaya'],
        url: 'https://sfx.suro-buya.local/magic/sparkle.mp3',
        duration: 2.0,
        category: 'magic',
    },
    {
        id: 'whoosh',
        keywords: ['whoosh', 'swish', 'swing', 'ayunan', 'lewat', 'sapuan'],
        url: 'https://sfx.suro-buya.local/magic/whoosh.mp3',
        duration: 0.8,
        category: 'magic',
    },
];

/**
 * Cek apakah action description mengandung salah satu keyword.
 * Case-insensitive matching.
 */
function actionMatchesKeywords(action: string, keywords: string[]): boolean {
    const lowerAction = action.toLowerCase();
    return keywords.some((keyword) => lowerAction.includes(keyword.toLowerCase()));
}

/**
 * Pilih SFX untuk satu shot berdasarkan action description.
 *
 * @param shot Shot spec
 * @param library SFX library
 * @returns SFX yang cocok (bisa kosong kalau tidak ada match)
 */
export function selectSfxForShot(
    shot: ShotSpec,
    library: SfxLibraryEntry[] = DEFAULT_SFX_LIBRARY,
): SfxLibraryEntry[] {
    return library.filter((entry) => actionMatchesKeywords(shot.action, entry.keywords));
}

/**
 * Pilih SFX untuk semua shot dalam storyboard.
 *
 * @param shots Shot list dari storyboard
 * @param library SFX library (default: DEFAULT_SFX_LIBRARY)
 * @returns SFX selection per shot + unmatched shots
 */
export function selectSfxForShots(
    shots: ShotSpec[],
    library: SfxLibraryEntry[] = DEFAULT_SFX_LIBRARY,
): SfxSelectionResult {
    const selections: SelectedSfx[] = [];
    const unmatchedShots: number[] = [];
    const warnings: string[] = [];

    for (const shot of shots) {
        const matched = selectSfxForShot(shot, library);

        if (matched.length === 0) {
            unmatchedShots.push(shot.index);
            continue;
        }

        selections.push({
            shotIndex: shot.index,
            sfx: matched,
            matchedAction: shot.action,
        });

        // Warning kalau terlalu banyak SFX untuk satu shot
        if (matched.length > 3) {
            warnings.push(
                `Shot ${shot.index}: ${matched.length} SFX matched — consider simplifying action description.`,
            );
        }
    }

    return {
        selections,
        unmatchedShots,
        warnings,
    };
}