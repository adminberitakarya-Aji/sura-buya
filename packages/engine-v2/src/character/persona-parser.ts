/**
 * Suro-Buya Engine v2 - Persona Parser (VF-1.2)
 *
 * Mengubah input Step 1 wizard "Create New Character" — baik teks bebas
 * (Opsi A, di-strukturisasi AI) maupun form manual (Opsi B) — menjadi
 * `PersonaDraft` yang siap direview user di Step 2.
 *
 * PENTING: modul ini TIDAK menyimpan apapun ke database. Penyimpanan
 * permanen ke model `Character` (Bible) baru terjadi di VF-1.5
 * (character-builder.ts) setelah user approve draft di Step 2 — lihat
 * REDESIGN-VIDEO-FACTORY.md §2.4 untuk alur lengkapnya.
 */

import { randomUUID } from 'node:crypto';
import type { AIProvider, AIProviderOptions } from '../ai/providers.js';
import { VIDEO_SCHEMAS } from '@suro-buya/shared';
import type { ManualPersonaInput, PersonaDraft } from '@suro-buya/shared';

/**
 * Field wajib yang harus muncul di JSON hasil parsing AI. Dipakai untuk
 * mendeteksi field mana yang AI "karang"/tebak (masuk fieldsNeedingReview)
 * vs field yang benar-benar didukung oleh teks input.
 */
const REQUIRED_PERSONA_FIELDS = [
    'name',
    'displayName',
    'role',
    'species',
    'ageDescriptor',
    'description',
    'coreTraits',
    'coreWeakness',
    'voiceGuide',
    'visualDescription',
] as const;

/**
 * Error khusus untuk kegagalan parsing — menyimpan raw response AI supaya
 * gampang didebug tanpa mengekspos itu ke user (UI cukup tampilkan pesan
 * generik + tombol "coba lagi" atau "isi manual").
 */
export class PersonaParseError extends Error {
    constructor(
        message: string,
        public readonly rawResponse?: string,
    ) {
        super(message);
        this.name = 'PersonaParseError';
    }
}

/**
 * System prompt untuk strukturisasi persona. Ditulis dalam Bahasa Indonesia
 * karena target output (Character Bible) juga berbahasa Indonesia.
 *
 * PENTING: platform ini generik lintas universe — Suro & Buya (target
 * keluarga/anak) hanyalah SALAH SATU contoh universe, bukan asumsi default
 * platform. `audienceProfile` diambil dari konfigurasi Universe (manifest)
 * pemanggil dan disuntikkan di sini per-panggilan — TIDAK ada batasan usia
 * atau tema yang di-hardcode di level engine. Kalau Universe tidak
 * mengonfigurasi audienceProfile, dipakai guideline netral (tidak mengasumsikan
 * segmen umur/tema tertentu).
 */
function buildSystemPrompt(audienceProfile?: string): string {
    const audienceGuideline = audienceProfile
        ? `Panduan audiens untuk universe ini: ${audienceProfile}`
        : 'Tidak ada panduan audiens spesifik dari universe ini — susun persona secara netral apa adanya sesuai deskripsi user, tanpa mengasumsikan segmen usia atau tema tertentu.';

    return `Kamu adalah asisten yang membantu creator konten menyusun Character Bible dari deskripsi bebas.

${audienceGuideline}

Tugasmu: baca deskripsi karakter yang ditulis user (bisa berupa kalimat santai, tidak terstruktur), lalu strukturisasi jadi JSON dengan field berikut PERSIS:

{
  "name": string,            // slug internal lowercase-dengan-tanda-hubung, mis. "kiko-si-kelinci" -> "kiko"
  "displayName": string,     // nama tampilan lengkap, mis. "Kiko si Kelinci Pemberani"
  "role": "PROTAGONIST" | "DEUTERAGONIST" | "SUPPORTING" | "ANTAGONIST" | "NARRATOR",
  "species": string,         // jenis/spesies karakter (bebas — manusia, hewan, makhluk fiksi, dll)
  "ageDescriptor": string,   // deskripsi umur naratif, mis. "dewasa muda, sekitar 28 tahun" — sesuaikan dengan audiens universe
  "description": string,     // deskripsi umum 2-4 kalimat
  "coreTraits": string[],    // 3-6 sifat inti
  "coreWeakness": string,    // kelemahan/ketakutan utama — WAJIB diisi walau harus menebak dari konteks
  "motivation": string,      // opsional, apa yang mendorong karakter ini bertindak
  "voiceGuide": string,      // cara bicara/nada suara karakter
  "visualDescription": string // deskripsi visual detail untuk dipakai generate reference image (warna, bentuk tubuh, pakaian, ekspresi khas)
}

ATURAN PENTING:
- Ikuti panduan audiens di atas apa adanya — jangan menambah pembatasan tema/nada sendiri kalau tidak diminta, dan jangan mengasumsikan ini untuk anak-anak kecuali panduan audiens memang menyebutkan itu.
- Kalau user tidak menyebutkan suatu field secara eksplisit (terutama coreWeakness, motivation, atau voiceGuide), TETAP isi dengan tebakan masuk akal berdasarkan konteks — jangan kosongkan. Field yang kamu tebak akan ditandai terpisah, jadi lebih baik menebak dengan wajar daripada mengosongkan.
- Balas HANYA dengan JSON valid, tanpa teks pembuka/penutup, tanpa markdown code fence.`;
}

/**
 * Deteksi field mana yang kemungkinan besar ditebak AI (bukan berasal
 * eksplisit dari input user) — heuristik sederhana: cek apakah konsep/kata
 * kunci dari nilai field itu (atau sinonim dekatnya) muncul di teks input
 * asli. Ini BUKAN deteksi sempurna — tujuannya cuma memberi sinyal awal ke
 * UI Step 2 supaya user tahu bagian mana yang paling perlu dicek, bukan
 * jaminan akurasi.
 */
function detectFieldsNeedingReview(
    parsed: Record<string, unknown>,
    rawInput: string,
): string[] {
    const inputLower = rawInput.toLowerCase();
    const flagged: string[] = [];

    // coreWeakness dan motivation paling sering ditebak karena user jarang
    // menyebutkan kelemahan karakter secara eksplisit di deskripsi santai
    for (const field of ['coreWeakness', 'motivation'] as const) {
        const value = parsed[field];
        if (typeof value !== 'string' || value.length === 0) continue;

        // Ambil 2-3 kata kunci pertama dari nilai yang di-generate AI, cek
        // apakah ada jejaknya di input asli
        const keywords = value
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 4)
            .slice(0, 3);

        const hasTraceInInput = keywords.some((kw) => inputLower.includes(kw));
        if (!hasTraceInInput) {
            flagged.push(field);
        }
    }

    // Field yang sama sekali tidak ada di output tapi wajib -> pasti ditebak/default
    for (const field of REQUIRED_PERSONA_FIELDS) {
        if (!(field in parsed) || parsed[field] === undefined || parsed[field] === null) {
            if (!flagged.includes(field)) flagged.push(field);
        }
    }

    return flagged;
}

/**
 * Bersihkan response AI dari code fence markdown (```json ... ```) yang
 * kadang tetap muncul walau sudah diinstruksikan untuk tidak — beberapa
 * provider (terutama lewat system prompt yang kurang strict) suka
 * membungkus JSON dengan fence meski diminta tidak.
 */
function stripCodeFence(text: string): string {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return fenceMatch?.[1] ?? trimmed;
}

/**
 * Parsing utama — Step 1 Opsi A (free-text via AI).
 *
 * @param rawInput Teks bebas yang ditulis user
 * @param provider AIProvider yang sudah dikonfigurasi (reuse ai/providers.ts existing — task creative-generation/planning)
 * @param audienceProfile Panduan audiens/nada dari konfigurasi Universe pemanggil (mis. "keluarga, semua umur", "young adult, tema petualangan"), opsional. Engine ini TIDAK mengasumsikan audiens tertentu secara default — setiap universe (Suro & Buya maupun universe lain) menentukan sendiri lewat parameter ini.
 */
export async function parseFreeTextToPersona(
    rawInput: string,
    provider: AIProvider,
    audienceProfile?: string,
): Promise<PersonaDraft> {
    if (rawInput.trim().length < 10) {
        throw new PersonaParseError(
            'Deskripsi karakter terlalu pendek untuk di-strukturisasi. Minimal beberapa kalimat, atau gunakan form manual.',
        );
    }

    const options: AIProviderOptions = {
        systemPrompt: buildSystemPrompt(audienceProfile),
        temperature: 0.4, // rendah — ini tugas strukturisasi, bukan tugas kreatif bebas
        maxTokens: 800,
    };
    const response = await provider.generate(rawInput, options);

    if (response.finishReason === 'error' || !response.content) {
        throw new PersonaParseError(
            `Gagal menghubungi AI provider (${provider.name}) untuk strukturisasi persona.`,
            response.content,
        );
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(stripCodeFence(response.content));
    } catch {
        throw new PersonaParseError(
            'AI tidak mengembalikan JSON yang valid. Coba tulis ulang deskripsi, atau gunakan form manual.',
            response.content,
        );
    }

    const fieldsNeedingReview = detectFieldsNeedingReview(parsed, rawInput);

    const draft: PersonaDraft = {
        draftId: randomUUID(),
        source: 'ai-parsed',
        name: String(parsed['name'] ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        displayName: String(parsed['displayName'] ?? ''),
        role: (parsed['role'] as PersonaDraft['role']) ?? 'SUPPORTING',
        species: String(parsed['species'] ?? ''),
        ageDescriptor: String(parsed['ageDescriptor'] ?? ''),
        description: String(parsed['description'] ?? ''),
        coreTraits: Array.isArray(parsed['coreTraits'])
            ? (parsed['coreTraits'] as unknown[]).map(String)
            : [],
        coreWeakness: String(parsed['coreWeakness'] ?? ''),
        motivation: parsed['motivation'] ? String(parsed['motivation']) : undefined,
        voiceGuide: String(parsed['voiceGuide'] ?? ''),
        visualDescription: String(parsed['visualDescription'] ?? ''),
        fieldsNeedingReview,
        rawInput,
    };

    // Validasi struktural terakhir sebelum dikembalikan ke caller (API route
    // VF-1.8). Kalau AI menghasilkan field yang secara tipe/panjang tidak
    // sesuai (mis. coreTraits kosong), lempar error yang jelas alih-alih
    // meloloskan draft cacat ke UI Step 2.
    const result = VIDEO_SCHEMAS.personaDraft.safeParse(draft);
    if (!result.success) {
        throw new PersonaParseError(
            `Hasil parsing AI tidak lolos validasi: ${result.error.issues.map((i) => i.message).join('; ')}`,
            response.content,
        );
    }

    return result.data;
}

/**
 * Step 1 Opsi B — form manual, tanpa AI. Dipakai saat user memilih "Isi
 * form manual" alih-alih menulis teks bebas. Tidak ada fieldsNeedingReview
 * karena semua field diisi langsung oleh user.
 */
export function buildManualDraft(input: ManualPersonaInput): PersonaDraft {
    const draft: PersonaDraft = {
        ...input,
        draftId: randomUUID(),
        source: 'manual',
        fieldsNeedingReview: [],
    };

    const result = VIDEO_SCHEMAS.personaDraft.safeParse(draft);
    if (!result.success) {
        throw new PersonaParseError(
            `Input form tidak lengkap/valid: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        );
    }

    return result.data;
}

/**
 * Dipakai di Step 2 (review) setelah user mengedit draft — baik yang berasal
 * dari AI maupun manual — sebelum dikirim ke character-builder.ts (VF-1.5)
 * untuk disimpan permanen. Memastikan hasil edit user tetap valid.
 */
export function validatePersonaDraft(draft: unknown): PersonaDraft {
    const result = VIDEO_SCHEMAS.personaDraft.safeParse(draft);
    if (!result.success) {
        throw new PersonaParseError(
            `Draft tidak valid: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        );
    }
    return result.data;
} 