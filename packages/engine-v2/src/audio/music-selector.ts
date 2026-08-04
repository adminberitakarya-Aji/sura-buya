/**
 * Suro-Buya Engine v2 - Music Selector (VF-4.3)
 *
 * Pilih background music (BGM) untuk video berdasarkan mood/genre/tone
 * dari storyboard. BGM dipilih dari library statis — dipetakan dari
 * mood/genre yang diinfer dari ShotSpec[] ke URL BGM file.
 *
 * BGM file disimpan di S3-compatible storage (R2/Tigris, lihat
 * REDESIGN-VIDEO-FACTORY.md §4).
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan sfx-selector.ts (VF-4.3).
 */

import type { ShotSpec, ContentRating } from '@suro-buya/shared';

/**
 * Satu entry di music library.
 */
export interface MusicLibraryEntry {
    /** ID unik track, mis. "adventure_upbeat" */
    id: string;

    /** Mood/genre tags yang dipakai untuk matching */
    moods: string[];

    /** URL BGM file di storage */
    url: string;

    /** Durasi track dalam detik */
    duration: number;

    /** Tempo dalam BPM (beats per minute) */
    bpm: number;

    /** Genre musik, mis. "orchestral", "electronic", "acoustic" */
    genre: string;

    /** Rating yang cocok untuk track ini */
    suitableRatings: ContentRating[];
}

/**
 * Hasil seleksi music untuk video.
 */
export interface MusicSelectionResult {
    /** Track yang dipilih (primary) */
    primaryTrack: MusicLibraryEntry | null;

    /** Track alternatif (fallback) */
    alternativeTracks: MusicLibraryEntry[];

    /** Mood yang diinfer dari storyboard */
    inferredMood: string;

    /** Warning dari proses seleksi */
    warnings: string[];
}

/**
 * Default music library — katalog dasar untuk video pendek.
 *
 * Di production, library ini bisa diperluas dengan track tambahan dari
 * S3-compatible storage. URL di sini adalah placeholder — di production
 * diganti dengan URL R2/Tigris yang sebenarnya.
 */
export const DEFAULT_MUSIC_LIBRARY: MusicLibraryEntry[] = [
    // Adventure
    {
        id: 'adventure_upbeat',
        moods: ['adventure', 'petualangan', 'exciting', 'fun', 'ceria', 'playful', 'happy'],
        url: 'https://music.suro-buya.local/adventure/upbeat.mp3',
        duration: 60,
        bpm: 120,
        genre: 'orchestral',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },
    {
        id: 'adventure_epic',
        moods: ['epic', 'heroic', 'berani', 'pemberani', 'grand', 'megah'],
        url: 'https://music.suro-buya.local/adventure/epic.mp3',
        duration: 60,
        bpm: 140,
        genre: 'orchestral',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },

    // Calm/Peaceful
    {
        id: 'calm_peaceful',
        moods: ['calm', 'peaceful', 'tenang', 'damai', 'serene', 'gentle', 'lembut'],
        url: 'https://music.suro-buya.local/calm/peaceful.mp3',
        duration: 60,
        bpm: 70,
        genre: 'acoustic',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },
    {
        id: 'calm_nature',
        moods: ['nature', 'alam', 'natural', 'forest', 'hutan', 'ocean', 'laut'],
        url: 'https://music.suro-buya.local/calm/nature.mp3',
        duration: 60,
        bpm: 80,
        genre: 'ambient',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },

    // Tense/Suspense
    {
        id: 'tense_suspense',
        moods: ['tense', 'suspense', 'tegang', 'misteri', 'mystery', 'thriller'],
        url: 'https://music.suro-buya.local/tense/suspense.mp3',
        duration: 60,
        bpm: 100,
        genre: 'electronic',
        suitableRatings: ['TEEN', 'MATURE'],
    },
    {
        id: 'tense_dark',
        moods: ['dark', 'gelap', 'menacing', 'threatening', 'bahaya', 'danger'],
        url: 'https://music.suro-buya.local/tense/dark.mp3',
        duration: 60,
        bpm: 90,
        genre: 'electronic',
        suitableRatings: ['MATURE'],
    },

    // Emotional
    {
        id: 'emotional_sad',
        moods: ['sad', 'sedih', 'melancholy', 'melankolis', 'emotional', 'touching'],
        url: 'https://music.suro-buya.local/emotional/sad.mp3',
        duration: 60,
        bpm: 60,
        genre: 'orchestral',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },
    {
        id: 'emotional_heartwarming',
        moods: ['heartwarming', 'touching', 'warm', 'hangat', 'moving', 'sentimental'],
        url: 'https://music.suro-buya.local/emotional/heartwarming.mp3',
        duration: 60,
        bpm: 75,
        genre: 'acoustic',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },

    // Fun/Playful
    {
        id: 'fun_playful',
        moods: ['fun', 'playful', 'ceria', 'lucu', 'silly', 'comedy', 'komedi'],
        url: 'https://music.suro-buya.local/fun/playful.mp3',
        duration: 60,
        bpm: 130,
        genre: 'electronic',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },
    {
        id: 'fun_energetic',
        moods: ['energetic', 'energi', 'fast', 'cepat', 'dynamic', 'dynamis'],
        url: 'https://music.suro-buya.local/fun/energetic.mp3',
        duration: 60,
        bpm: 150,
        genre: 'electronic',
        suitableRatings: ['ALL_AGES', 'TEEN', 'MATURE'],
    },
];

/**
 * Infer mood dari storyboard berdasarkan action descriptions dan camera angles.
 *
 * Menghitung keyword frequency dari semua shot actions untuk menentukan
 * mood dominan video.
 */
export function inferMoodFromStoryboard(shots: ShotSpec[]): string {
    const moodKeywords: Record<string, string[]> = {
        adventure: ['run', 'chase', 'explore', 'discover', 'journey', 'lari', 'kejar', 'jelajah', 'temukan', 'petualangan'],
        calm: ['sit', 'rest', 'peaceful', 'quiet', 'calm', 'duduk', 'istirahat', 'tenang', 'damai'],
        tense: ['fight', 'escape', 'danger', 'chase', 'hide', 'fight', 'lari', 'bahaya', 'kabur', 'sembunyi'],
        sad: ['cry', 'alone', 'lost', 'miss', 'sedih', 'menangis', 'sendiri', 'tersesat', 'rindu'],
        fun: ['laugh', 'play', 'dance', 'jump', 'happy', 'tertawa', 'bermain', 'menari', 'lompat', 'senang'],
    };

    const moodScores: Record<string, number> = {};

    for (const shot of shots) {
        const lowerAction = shot.action.toLowerCase();
        for (const [mood, keywords] of Object.entries(moodKeywords)) {
            for (const keyword of keywords) {
                if (lowerAction.includes(keyword.toLowerCase())) {
                    moodScores[mood] = (moodScores[mood] ?? 0) + 1;
                }
            }
        }
    }

    // Find mood with highest score
    let bestMood = 'adventure'; // default
    let bestScore = 0;

    for (const [mood, score] of Object.entries(moodScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestMood = mood;
        }
    }

    return bestMood;
}

/**
 * Pilih music untuk video berdasarkan storyboard.
 *
 * Alur:
 * 1. Infer mood dari storyboard (action descriptions)
 * 2. Cari track di library yang match mood dan suitable untuk contentRating
 * 3. Return primary track + alternatives
 *
 * @param shots Shot list dari storyboard
 * @param contentRating Rating universe (ALL_AGES/TEEN/MATURE)
 * @param library Music library (default: DEFAULT_MUSIC_LIBRARY)
 * @returns Music selection (primary + alternatives)
 */
export function selectMusicForVideo(
    shots: ShotSpec[],
    contentRating: ContentRating = 'ALL_AGES',
    library: MusicLibraryEntry[] = DEFAULT_MUSIC_LIBRARY,
): MusicSelectionResult {
    const warnings: string[] = [];

    // 1. Infer mood from storyboard
    const inferredMood = inferMoodFromStoryboard(shots);

    // 2. Filter library by content rating
    const suitableTracks = library.filter((track) =>
        track.suitableRatings.includes(contentRating),
    );

    if (suitableTracks.length === 0) {
        warnings.push(
            `No music tracks suitable for content rating "${contentRating}" — video will have no BGM.`,
        );
        return {
            primaryTrack: null,
            alternativeTracks: [],
            inferredMood,
            warnings,
        };
    }

    // 3. Match mood
    const moodMatched = suitableTracks.filter((track) =>
        track.moods.some(
            (mood) => mood.toLowerCase() === inferredMood.toLowerCase(),
        ),
    );

    if (moodMatched.length === 0) {
        // Fallback: kalau tidak ada match mood yang exact, cari yang moods-nya overlap
        const partialMatched = suitableTracks.filter((track) =>
            track.moods.some((mood) =>
                mood.toLowerCase().includes(inferredMood.toLowerCase()) ||
                inferredMood.toLowerCase().includes(mood.toLowerCase()),
            ),
        );

        if (partialMatched.length === 0) {
            // Last resort: return first suitable track
            warnings.push(
                `No music track matching mood "${inferredMood}" — using first suitable track as fallback.`,
            );
            return {
                primaryTrack: suitableTracks[0] ?? null,
                alternativeTracks: suitableTracks.slice(1, 4),
                inferredMood,
                warnings,
            };
        }

        return {
            primaryTrack: partialMatched[0] ?? null,
            alternativeTracks: partialMatched.slice(1, 4),
            inferredMood,
            warnings,
        };
    }

    return {
        primaryTrack: moodMatched[0] ?? null,
        alternativeTracks: moodMatched.slice(1, 4),
        inferredMood,
        warnings,
    };
}
