/**
 * Suro-Buya Engine v2 - Script Generator (VF-2.2)
 *
 * Generate naskah video pendek dari karakter (VideoCharacterContext, VF-2.0)
 * + ide cerita. Kalau bagian dari VideoSeries, muat konteks episode
 * sebelumnya via helper buildSeriesContextPrompt() terpisah.
 *
 * PENTING: modul ini TIDAK menyimpan apapun ke database. Pola yang sama
 * dengan persona-parser.ts (VF-1.2) — pure logic, gunakan AIProvider
 * interface, tidak akses Prisma langsung.
 *
 * PENTING — soal tipe data: modul ini pakai VideoCharacterContext (VF-2.0),
 * BUKAN CharacterProfile lama (types/index.ts) yang punya struktur berbeda
 * (archetype vs role, traits vs coreTraits, voice object vs voiceGuide string).
 * Bridge layer di apps/web yang konversi Prisma Character+CharacterAsset
 * → VideoCharacterContext saat memanggil engine-v2.
 *
 * PENTING — soal ContextBuilder: modul ini TIDAK reuse ContextBuilder
 * (bible/context-builder.ts) langsung karena ContextBuilder didesain untuk
 * Bible file loading (butuh BibleLoader, BibleIndexer, universeId), bukan
 * untuk riwayat script antar-episode. buildSeriesContextPrompt() adalah
 * helper terpisah yang format episode sebelumnya jadi ringkasan naratif.
 */

import type { AIProvider, AIProviderOptions } from '../ai/providers.js';
import type { VideoCharacterContext, ContentRating } from '@suro-buya/shared';
import { generateBeatSheet, type BeatSheet, type VideoDuration } from './beat-sheet.js';

/**
 * Konteks episode sebelumnya untuk continuity series.
 * Dipakai saat VideoProject adalah episode ke-2+ dalam VideoSeries.
 */
export interface PreviousEpisode {
  /** Urutan episode dalam series */
  episodeOrder: number;
  /** Judul episode */
  title: string;
  /** Naskah lengkap episode sebelumnya */
  script: string;
  /** Ringkasan singkat episode sebelumnya (bisa di-generate atau manual) */
  summary: string;
}

/**
 * Konteks series untuk continuity.
 */
export interface SeriesContext {
  /** ID VideoSeries */
  seriesId: string;
  /** Urutan episode ini dalam series (1-based) */
  episodeOrder: number;
  /** Episode-episode sebelumnya dalam series */
  previousEpisodes: PreviousEpisode[];
}

/**
 * Input untuk script generation.
 */
export interface ScriptGeneratorInput {
  /** Karakter utama — VideoCharacterContext (VF-2.0), BUKAN CharacterProfile */
  character: VideoCharacterContext;

  /** Ide cerita bebas teks dari user */
  storyIdea: string;

  /** Target durasi video (15, 30, atau 60 detik) */
  targetDuration: VideoDuration;

  /** Rating universe pemanggil — dari @suro-buya/shared (VF-2.0) */
  contentRating: ContentRating;

  /** Profil audiens bebas teks dari universe */
  audienceProfile?: string;

  /** Konteks series — opsional, hanya kalau bagian VideoSeries */
  seriesContext?: SeriesContext;
}

/**
 * Hasil script generation.
 */
export interface ScriptGeneratorResult {
  /** Naskah lengkap */
  script: string;

  /** Judul yang diusulkan untuk episode/video */
  title: string;

  /** Estimasi durasi dalam detik (harus mendekati targetDuration) */
  estimatedDuration: number;

  /** Jumlah beat yang tercakup */
  beatCount: number;

  /** Beat sheet yang dipakai sebagai struktur */
  beatSheet: BeatSheet;

  /** Metadata AI provider */
  metadata: {
    providerUsed: string;
    tokensUsed: number;
    modelUsed: string;
  };
}

/**
 * Error khusus untuk kegagalan script generation.
 */
export class ScriptGenerationError extends Error {
  constructor(
    message: string,
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = 'ScriptGenerationError';
  }
}

/**
 * Build system prompt untuk script generation.
 *
 * Pola yang sama dengan persona-parser.ts (VF-1.2):
 * - Bahasa Indonesia
 * - Terima audienceProfile sebagai parameter opsional
 * - Tidak hardcode asumsi audiens
 * - Instruksikan format naskah video pendek (9:16, vertikal)
 */
function buildSystemPrompt(
  character: VideoCharacterContext,
  beatSheet: BeatSheet,
  contentRating: ContentRating,
  audienceProfile?: string,
): string {
  const audienceGuideline = audienceProfile
    ? `Panduan audiens untuk universe ini: ${audienceProfile}`
    : 'Tidak ada panduan audiens spesifik dari universe ini — tulis naskah secara netral apa adanya sesuai ide cerita, tanpa mengasumsikan segmen usia atau tema tertentu.';

  const ratingGuideline: Record<ContentRating, string> = {
    ALL_AGES: 'Rating universe: ALL_AGES — hindari kekerasan eksplisit, konten seksual, narkoba, bahasa kasar, dan tema self-harm.',
    TEEN: 'Rating universe: TEEN — kekerasan ringan boleh, tapi hindari konten seksual eksplisit dan kekerasan grafis.',
    MATURE: 'Rating universe: MATURE — tema intens, kekerasan, dan bahasa kasar diperbolehkan. Hanya konten ilegal (pedofilia, terorisme) yang dilarang.',
  };

  const beatStructure = beatSheet.beats
    .map((b) => `${b.index + 1}. ${b.label} (${b.durationSeconds}s): ${b.description}`)
    .join('\n');

  return `Kamu adalah penulis naskah video pendek vertikal (9:16, TikTok/YouTube Shorts/Reels) untuk karakter "${character.displayName}".

${audienceGuideline}

${ratingGuideline[contentRating]}

## KARAKTER
- Nama: ${character.displayName}
- Peran: ${character.role}
- Spesies: ${character.metadata.species}
- Umur: ${character.metadata.ageDescriptor}
- Deskripsi: ${character.description}
- Sifat inti: ${character.coreTraits.join(', ')}
- Kelemahan utama: ${character.coreWeakness}
- Motivasi: ${character.metadata.motivation ?? 'Tidak spesifik'}
- Cara bicara: ${character.voiceGuide}

## STRUKTUR CERITA (${beatSheet.duration} detik, ${beatSheet.totalBeats} beat)
${beatStructure}

## ATURAN
1. Tulis naskah dalam Bahasa Indonesia
2. Ikuti struktur beat di atas — setiap beat harus tercakup
3. Dialog karakter harus konsisten dengan cara bicara di atas
4. Karakter harus bertindak sesuai sifat inti dan kelemahan utama
5. Total durasi naskah harus mendekati ${beatSheet.duration} detik
6. Format: tulis nama beat sebagai heading, lalu dialog/narasi di bawahnya
7. Untuk dialog, tulis nama karakter dalam CAPS diikuti dialog dalam tanda kutip
8. Untuk aksi/visual, tulis dalam tanda kurung siku [seperti ini]
9. Balas HANYA dengan naskah, tanpa teks pembuka/penutup

## OUTPUT FORMAT
Judul: [judul singkat menarik]

[Beat 1: Hook]
...

[Beat 2: ...]
...

(dst)`;
}

/**
 * Build konteks episode sebelumnya untuk continuity series.
 *
 * Helper terpisah — TIDAK reuse ContextBuilder (bible/context-builder.ts)
 * karena ContextBuilder didesain untuk Bible file loading (butuh BibleLoader,
 * BibleIndexer, universeId), bukan untuk riwayat script antar-episode.
 *
 * @param seriesContext Konteks series dengan episode sebelumnya
 * @returns String ringkasan naratif untuk disuntikkan ke prompt
 */
export function buildSeriesContextPrompt(seriesContext: SeriesContext): string {
  if (!seriesContext.previousEpisodes || seriesContext.previousEpisodes.length === 0) {
    return `Ini adalah episode pertama (episode ${seriesContext.episodeOrder}) dalam series ini.`;
  }

  const previousSummaries = seriesContext.previousEpisodes
    .map((ep) => {
      // Ambil ringkasan kalau ada, kalau tidak potong script jadi ringkasan
      const summary = ep.summary || ep.script.substring(0, 200) + '...';
      return `Episode ${ep.episodeOrder}: "${ep.title}" — ${summary}`;
    })
    .join('\n\n');

  return `Ini adalah episode ${seriesContext.episodeOrder} dalam series ini.

## EPISODE SEBELUMNYA (untuk continuity)
${previousSummaries}

## PENTING
- Naskah episode ini harus konsisten dengan event di episode sebelumnya
- Karakter harus "ingat" apa yang terjadi di episode sebelumnya
- Bisa referensi event sebelumnya secara natural, jangan ulangi cerita lama
- Kalau ada cliffhanger di episode sebelumnya, lanjutkan atau selesaikan di sini`;
}

/**
 * Parse judul dari response AI.
 * Format yang diharapkan: "Judul: [judul]" di baris pertama.
 */
function parseTitle(response: string): string {
  const titleMatch = response.match(/^Judul:\s*(.+)$/im);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  // Fallback: ambil baris pertama yang bukan heading beat
  const lines = response.split('\n').filter((l) => l.trim() && !l.trim().startsWith('['));
  return lines[0]?.trim().substring(0, 100) || 'Untitled Video';
}

/**
 * Hapus baris "Judul:" dari naskah (karena judul sudah dipisah).
 */
function stripTitleLine(response: string): string {
  return response.replace(/^Judul:\s*.+$\n?/im, '').trim();
}

/**
 * Hitung estimasi durasi naskah berdasarkan jumlah kata.
 * Estimasi: 1 detik ≈ 3-5 kata dialog/narasi.
 */
function estimateDuration(script: string): number {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(wordCount / 4); // rata-rata 4 kata per detik
}

/**
 * Hitung jumlah beat yang tercakup di naskah.
 */
function countBeats(script: string, beatSheet: BeatSheet): number {
  let count = 0;
  for (const beat of beatSheet.beats) {
    // Cek apakah label beat muncul di naskah
    const labelPattern = new RegExp(`\\[?${beat.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?`, 'i');
    if (labelPattern.test(script)) {
      count++;
    }
  }
  return count;
}

/**
 * Generate naskah video pendek dari karakter + ide cerita.
 *
 * @param input Karakter + ide cerita + durasi + rating + (opsional) series context
 * @param provider AIProvider yang sudah dikonfigurasi (reuse ai/providers.ts existing)
 * @returns Naskah + judul + metadata
 */
export async function generateScript(
  input: ScriptGeneratorInput,
  provider: AIProvider,
): Promise<ScriptGeneratorResult> {
  const { character, storyIdea, targetDuration, contentRating, audienceProfile, seriesContext } = input;

  if (storyIdea.trim().length < 5) {
    throw new ScriptGenerationError('Ide cerita terlalu pendek. Minimal beberapa kata.');
  }

  // Generate beat sheet untuk durasi target
  const beatSheet = generateBeatSheet(targetDuration);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(character, beatSheet, contentRating, audienceProfile);

  // Build user prompt — ide cerita + (kalau series) konteks episode sebelumnya
  let userPrompt = `## IDE CERITA\n${storyIdea}`;

  if (seriesContext) {
    userPrompt += `\n\n${buildSeriesContextPrompt(seriesContext)}`;
  }

  userPrompt += `\n\nTulis naskah lengkap untuk video ${targetDuration} detik mengikuti struktur beat di atas.`;

  const options: AIProviderOptions = {
    systemPrompt,
    temperature: 0.7, // lebih tinggi dari persona-parser (0.4) karena ini tugas kreatif
    maxTokens: targetDuration === 15 ? 500 : targetDuration === 30 ? 1000 : 2000,
  };

  const response = await provider.generate(userPrompt, options);

  if (response.finishReason === 'error' || !response.content) {
    throw new ScriptGenerationError(
      `Gagal menghubungi AI provider (${provider.name}) untuk generate script.`,
      response.content,
    );
  }

  // Parse judul dan naskah
  const title = parseTitle(response.content);
  const script = stripTitleLine(response.content);

  if (script.trim().length < 20) {
    throw new ScriptGenerationError(
      'Naskah yang digenerate terlalu pendek. Coba tulis ulang ide cerita dengan lebih detail.',
      response.content,
    );
  }

  const estimatedDuration = estimateDuration(script);
  const beatCount = countBeats(script, beatSheet);

  return {
    script,
    title,
    estimatedDuration,
    beatCount,
    beatSheet,
    metadata: {
      providerUsed: provider.name,
      tokensUsed: response.usage.totalTokens,
      modelUsed: response.model,
    },
  };
}