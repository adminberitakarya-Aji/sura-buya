/**
 * Suro-Buya Engine v2 - Voiceover Generator (VF-4.3)
 *
 * TTS per dialog, sinkron ke shot. Ambil ShotSpec[] (storyboard VF-2.5),
 * untuk setiap shot yang punya dialog, sintesis voice via VoiceProvider /
 * MediaProviderRegistry (VF-4.1).
 *
 * Voice profile diambil dari CharacterAsset.voiceProfile — provider TIDAK
 * boleh punya default voice sendiri. Ini yang menjaga voice konsisten lintas
 * episode (VF-4 AC #2: "Voice karakter terdengar sama/konsisten di lebih
 * dari satu episode").
 *
 * PENTING: modul ini adalah orchestrator — tidak menyentuh Prisma/DB.
 * Hasilnya (GeneratedVoiceover[]) dikonsumsi caller (API route di apps/web
 * atau video-worker activity) yang bertanggung jawab simpan ke MediaAsset
 * (VF-3.6, type AUDIO). Pola yang sama dengan image-generator.ts (VF-3.2)
 * dan animation-generator.ts (VF-3.4): engine-v2 generate, apps/web persist.
 */

import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';
import { MediaProviderRegistry } from '../ai/media-providers/registry.js';
import { MockVoiceProvider } from '../ai/media-providers/mock-providers.js';

/**
 * Voice profile lookup — map characterId → voice profile.
 * Dibangun oleh caller dari CharacterAsset.voiceProfile (Prisma).
 */
export type VoiceProfileMap = Map<
    string,
    { provider: string; voiceId: string; settings?: Record<string, unknown> }
>;

/**
 * Input untuk generate voiceovers.
 */
export interface VoiceoverGeneratorInput {
    /** Shot list dari storyboard (VF-2.5) */
    shots: ShotSpec[];

    /**
     * Map characterId → voice profile. Dibangun dari CharacterAsset.voiceProfile.
     * Kalau shot punya dialog tapi karakter tidak ada di map ini, shot di-skip
     * dengan warning (tidak throw — video tetap bisa di-render tanpa voiceover
     * untuk shot itu).
     */
    voiceProfiles: VoiceProfileMap;

    /** Registry dengan voice provider sudah terdaftar. Kalau tidak disuplai, pakai mock default. */
    registry?: MediaProviderRegistry;

    /**
     * Kalau true, generate voiceover secara sequential (default, aman dari rate limit).
     * Kalau false, generate paralel (cepat tapi berisiko rate limit).
     */
    sequential?: boolean;
}

/**
 * Satu voiceover yang sudah digenerate.
 */
export interface GeneratedVoiceover {
    /** Index shot dalam storyboard (ShotSpec.index) */
    shotIndex: number;

    /** URL audio hasil sintesis (data URL atau hosted URL) */
    audioUrl: string;

    /** Nama provider yang berhasil (mis. "elevenlabs" atau "cartesia") */
    providerUsed: string;

    /** Biaya sintesis ini dalam USD */
    cost: number;

    /** Durasi aktual audio dalam detik */
    durationActual: number;

    /** Character ID yang berbicara di shot ini */
    characterId: string;

    /** Teks dialog yang disintesis */
    dialogueText: string;

    /** Voice ID yang dipakai (dari CharacterAsset.voiceProfile) */
    voiceId: string;

    /** Daftar provider yang dicoba (termasuk yang gagal) — untuk debugging */
    attempts: string[];
}

/**
 * Hasil generate voiceovers.
 */
export interface VoiceoverGeneratorResult {
    /** Voiceover per shot yang punya dialog */
    voiceovers: GeneratedVoiceover[];

    /** Total biaya semua voiceover dalam USD */
    totalCost: number;

    /** Provider yang dipakai untuk shot terakhir (untuk logging) */
    providerUsed: string;

    /** Warning dari proses generate */
    warnings: string[];

    /** Shot yang di-skip (tidak punya dialog atau voice profile tidak ditemukan) */
    skippedShots: number[];
}

/**
 * Error yang dilempar saat generate voiceovers gagal.
 */
export class VoiceoverGeneratorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VoiceoverGeneratorError';
    }
}

/**
 * Generate voiceover untuk satu shot.
 *
 * @param shot Shot spec (harus punya dialogue)
 * @param voiceProfile Voice profile karakter yang berbicara
 * @param registry Media provider registry
 * @returns Generated voiceover
 */
async function generateSingleVoiceover(
    shot: ShotSpec,
    voiceProfile: { provider: string; voiceId: string; settings?: Record<string, unknown> },
    registry: MediaProviderRegistry,
): Promise<GeneratedVoiceover> {
    if (!shot.dialogue) {
        throw new VoiceoverGeneratorError(
            `Shot ${shot.index} has no dialogue — cannot generate voiceover`,
        );
    }

    const { result, providerUsed, attempts } = await registry.synthesizeVoice({
        text: shot.dialogue.line,
        voiceId: voiceProfile.voiceId,
        settings: voiceProfile.settings,
    });

    return {
        shotIndex: shot.index,
        audioUrl: result.url,
        providerUsed,
        cost: result.cost ?? 0,
        durationActual: result.durationActual,
        characterId: shot.dialogue.characterId,
        dialogueText: shot.dialogue.line,
        voiceId: voiceProfile.voiceId,
        attempts,
    };
}

/**
 * Generate voiceover untuk semua shot yang punya dialog dalam storyboard.
 *
 * Alur:
 * 1. Validasi input (shots tidak kosong)
 * 2. Untuk setiap shot yang punya dialog:
 *    a. Cari voice profile untuk characterId di shot.dialogue
 *    b. Kalau tidak ada, skip shot dengan warning
 *    c. Sintesis voice via VoiceProvider/MediaProviderRegistry (VF-4.1)
 * 3. Track cost per voiceover dan total
 *
 * Shot tanpa dialog di-skip (tidak error — tidak semua shot punya dialog).
 *
 * @param input Shots + voice profiles + registry
 * @returns Generated voiceovers + metadata
 */
export async function generateVoiceovers(
    input: VoiceoverGeneratorInput,
): Promise<VoiceoverGeneratorResult> {
    // --- Validate input ---
    if (!input.shots || input.shots.length === 0) {
        throw new VoiceoverGeneratorError(
            'Cannot generate voiceovers: shots list is empty. Generate storyboard first (VF-2.5).',
        );
    }

    // --- Set up registry ---
    let registry = input.registry;
    if (!registry) {
        // Default fallback: mock provider (untuk testing tanpa API key nyata)
        registry = new MediaProviderRegistry();
        const mockProvider = new MockVoiceProvider('elevenlabs');
        registry.registerVoiceProvider(mockProvider);
        registry.setVoiceChain(['elevenlabs']);
    }

    const sequential = input.sequential ?? true; // default sequential (safe)

    const voiceovers: GeneratedVoiceover[] = [];
    const warnings: string[] = [];
    const skippedShots: number[] = [];
    let totalCost = 0;
    let lastProviderUsed = '';

    // --- Filter shots with dialogue ---
    const shotsWithDialogue = input.shots.filter((shot) => shot.dialogue);

    if (shotsWithDialogue.length === 0) {
        return {
            voiceovers: [],
            totalCost: 0,
            providerUsed: '',
            warnings: ['No shots with dialogue found — skipping voiceover generation.'],
            skippedShots: input.shots.map((s) => s.index),
        };
    }

    // --- Generate voiceovers ---
    if (sequential) {
        // Sequential: satu per satu (aman dari rate limit)
        for (const shot of shotsWithDialogue) {
            const voiceProfile = input.voiceProfiles.get(shot.dialogue!.characterId);

            if (!voiceProfile) {
                warnings.push(
                    `Shot ${shot.index}: no voice profile found for character "${shot.dialogue!.characterId}" — skipping voiceover.`,
                );
                skippedShots.push(shot.index);
                continue;
            }

            const voiceover = await generateSingleVoiceover(
                shot,
                voiceProfile,
                registry,
            );
            voiceovers.push(voiceover);
            totalCost += voiceover.cost;
            lastProviderUsed = voiceover.providerUsed;
        }
    } else {
        // Parallel: semua sekaligus (cepat tapi berisiko rate limit)
        const results = await Promise.all(
            shotsWithDialogue.map(async (shot) => {
                const voiceProfile = input.voiceProfiles.get(shot.dialogue!.characterId);

                if (!voiceProfile) {
                    return {
                        shot,
                        skipped: true,
                        voiceover: null as GeneratedVoiceover | null,
                    };
                }

                const voiceover = await generateSingleVoiceover(
                    shot,
                    voiceProfile,
                    registry,
                );
                return { shot, skipped: false, voiceover };
            }),
        );

        for (const { shot, skipped, voiceover } of results) {
            if (skipped || !voiceover) {
                warnings.push(
                    `Shot ${shot.index}: no voice profile found for character "${shot.dialogue!.characterId}" — skipping voiceover.`,
                );
                skippedShots.push(shot.index);
                continue;
            }
            voiceovers.push(voiceover);
            totalCost += voiceover.cost;
            lastProviderUsed = voiceover.providerUsed;
        }
    }

    // Sort by shot index (penting untuk parallel mode)
    voiceovers.sort((a, b) => a.shotIndex - b.shotIndex);
    skippedShots.sort((a, b) => a - b);

    return {
        voiceovers,
        totalCost: Math.round(totalCost * 10000) / 10000,
        providerUsed: lastProviderUsed,
        warnings,
        skippedShots,
    };
}

/**
 * Build VoiceProfileMap dari CharacterVisualProfile[] (dari CharacterAsset).
 *
 * Helper untuk caller (API route / video-worker) yang sudah load
 * CharacterAsset dari Prisma — konversi array ke Map untuk lookup cepat
 * per characterId.
 */
export function buildVoiceProfileMap(
    characters: Array<{
        characterId: string;
        visualProfile?: Pick<CharacterVisualProfile, 'voiceProfile'>;
    }>,
): VoiceProfileMap {
    const map: VoiceProfileMap = new Map();

    for (const char of characters) {
        if (char.visualProfile?.voiceProfile) {
            map.set(char.characterId, char.visualProfile.voiceProfile);
        }
    }

    return map;
}