/**
 * @suro-buya/shared - Video Factory Types
 *
 * Kontrak tipe untuk AI Video Factory (VF-1..VF-6). Ditaruh terpisah dari
 * types/index.ts (bukan digabung) supaya modul teks lama tidak perlu disentuh
 * sama sekali — sesuai prinsip "extend, don't rewrite" di
 * IMPLEMENTATION-PLAN-VIDEO-FACTORY.md.
 */

import { z } from 'zod';

/**
 * Role karakter — SENGAJA disamakan persis dengan enum `CharacterRole` di
 * apps/web/prisma/schema.prisma (PROTAGONIST | DEUTERAGONIST | SUPPORTING |
 * ANTAGONIST | NARRATOR). PersonaDraft harus bisa dipetakan 1:1 ke model
 * `Character` existing tanpa transformasi tambahan (lihat REDESIGN-VIDEO-FACTORY.md §2.3).
 */
export type CharacterRole =
    | 'PROTAGONIST'
    | 'DEUTERAGONIST'
    | 'SUPPORTING'
    | 'ANTAGONIST'
    | 'NARRATOR';

/**
 * ContentRating — mirror TypeScript dari enum Prisma `ContentRating`
 * (ALL_AGES | TEEN | MATURE) di apps/web/prisma/schema.prisma. Sengaja
 * di-mirror sebagai union type biasa di @suro-buya/shared (bukan import
 * dari Prisma) supaya engine-v2 tetap clean dari dependency Prisma —
 * pola yang sama yang sudah dipakai untuk CharacterRole di atas.
 *
 * Dipakai oleh: script-generator.ts (VF-2.2), content-guideline-check.ts
 * (VF-2.3), canon check video (VF-2.4). Tidak ada asumsi audiens default
 * di level engine — setiap universe menentukan rating-nya sendiri.
 */
export type ContentRating = 'ALL_AGES' | 'TEEN' | 'MATURE';

/**
 * Dari mana PersonaDraft ini berasal — menentukan apakah field-nya perlu
 * ditandai "perlu direview" di Step 2 wizard (lihat `fieldsNeedingReview`).
 */
export type PersonaDraftSource = 'ai-parsed' | 'manual';

/**
 * PersonaDraft — hasil Step 1 wizard "Create New Character" (baik dari
 * free-text yang di-strukturisasi AI, maupun dari form manual), SEBELUM
 * disetujui user di Step 2 dan disimpan permanen sebagai `Character` (Bible).
 *
 * PersonaDraft BUKAN entitas database — dia hidup di state UI/API request
 * selama wizard berjalan. Begitu user approve di Step 2, `character-builder.ts`
 * (VF-1.5) memetakan field-field ini ke model `Character` di Postgres.
 */
export interface PersonaDraft {
    /** ID sementara untuk melacak draft ini selama sesi wizard (bukan DB id) */
    draftId: string;

    /** Asal draft — dipakai UI untuk menentukan seberapa ketat Step 2 highlight perlu direview */
    source: PersonaDraftSource;

    /** Nama internal/slug karakter, mis. "suro" — dipetakan ke Character.characterId */
    name: string;

    /** Nama tampilan, mis. "Suro si Hiu Kecil" — dipetakan ke Character.displayName */
    displayName: string;

    /** Peran naratif — dipetakan ke Character.role */
    role: CharacterRole;

    /** Spesies/jenis karakter, mis. "anak hiu", "anak kucing" — bebas teks */
    species: string;

    /** Deskripsi umur dalam bentuk naratif, mis. "anak-anak, sekitar 9 tahun" (bukan angka strict karena karakter fiksi) */
    ageDescriptor: string;

    /** Deskripsi umum karakter — dipetakan ke Character.description */
    description: string;

    /** Sifat-sifat inti, mis. ["pemberani", "ingin tahu"] — dipetakan ke Character.coreTraits */
    coreTraits: string[];

    /** Kelemahan/ketakutan utama — dipetakan ke Character.coreWeakness. WAJIB diisi (baik oleh AI maupun user) sebelum draft bisa di-approve, karena ini sering jadi sumber konflik cerita */
    coreWeakness: string;

    /** Apa yang memotivasi karakter ini — opsional, tidak ada kolom Prisma langsung, disimpan di Character.metadata */
    motivation?: string;

    /** Panduan cara bicara/nada suara — dipetakan ke Character.voiceGuide */
    voiceGuide: string;

    /** Deskripsi visual bebas teks, dipakai reference-generator.ts (VF-1.6) untuk generate reference image. Tidak dipetakan ke kolom Character manapun — disimpan di CharacterAsset/metadata */
    visualDescription: string;

    /**
     * Nama field yang AI kurang yakin saat parsing (mis. karena input teks
     * bebas tidak menyebutkan kelemahan karakter secara eksplisit, jadi AI
     * menebak). UI Step 2 WAJIB menyorot field-field ini secara visual supaya
     * user tahu bagian mana yang paling perlu dicek ulang. Kosong kalau
     * source === 'manual'.
     */
    fieldsNeedingReview: string[];

    /** Teks asli yang diketik user (kalau source === 'ai-parsed') — disimpan untuk audit/debug, tidak ditampilkan ke user di Step 2 */
    rawInput?: string;
}

/**
 * Input form manual (Step 1, Opsi B) — subset PersonaDraft tanpa field yang
 * hanya relevan untuk hasil parsing AI (fieldsNeedingReview, rawInput).
 */
export type ManualPersonaInput = Omit<
    PersonaDraft,
    'draftId' | 'source' | 'fieldsNeedingReview' | 'rawInput'
>;

/**
 * CharacterVisualProfile — visual DNA karakter untuk konsistensi generation.
 * Dipetakan ke model Prisma `CharacterAsset` (relasi 1:1 ke `Character`).
 */
export interface CharacterVisualProfile {
    /** ID Character (Bible) yang punya profil visual ini — relasi 1:1 */
    characterId: string;

    /** URL reference image (turnaround: depan/samping/ekspresi) — mekanisme konsistensi DEFAULT, lihat REDESIGN-VIDEO-FACTORY.md §4 */
    referenceImages: string[];

    /** Tag gaya visual, mis. ["2D", "watercolor", "vibrant"] */
    styleTags: string[];

    /** Palet warna dominan, format hex */
    colorPalette?: string[];

    /** Prompt negatif — hal yang harus dihindari image generator untuk karakter ini */
    negativePrompt?: string;

    /** Referensi voice profile TTS — provider + voice_id + setting, isi bebas per provider */
    voiceProfile?: {
        provider: string;
        voiceId: string;
        settings?: Record<string, unknown>;
    };
}

/**
 * VideoCharacterContext — konteks karakter untuk Video Factory, dibangun
 * dari field Character + CharacterAsset + Character.metadata yang ASLI
 * (bukan CharacterProfile lama di types/index.ts yang punya struktur berbeda:
 * archetype vs role, traits vs coreTraits, voice object vs voiceGuide string).
 *
 * Ini yang dipakai script-generator.ts (VF-2.2), canon check (VF-2.4),
 * dan scene-breakdown.ts (VF-2.5) — BUKAN CharacterProfile.
 *
 * Bridge layer di apps/web yang bertanggung jawab memetakan
 * Character (Prisma) + CharacterAsset (Prisma) → VideoCharacterContext
 * saat memanggil engine-v2 — engine-v2 tidak pernah akses Prisma langsung
 * (pola yang sudah ditegakkan sejak VF-1.1, lihat character-builder.ts).
 */
export interface VideoCharacterContext {
    /** Character.id (Prisma primary key) */
    id: string;

    /** Slug internal, mis. "suro" — Character.characterId di Prisma */
    characterId: string;

    /** Nama tampilan lengkap — Character.displayName */
    displayName: string;

    /** Peran naratif — CharacterRole, BUKAN CharacterArchetype */
    role: CharacterRole;

    /** Deskripsi umum — Character.description */
    description: string;

    /** Sifat inti — Character.coreTraits, BUKAN CharacterProfile.traits */
    coreTraits: string[];

    /** Kelemahan/ketakutan utama — Character.coreWeakness (string, BUKAN array) */
    coreWeakness: string;

    /** Panduan cara bicara — Character.voiceGuide (string, BUKAN objek nested) */
    voiceGuide: string;

    /**
     * Field dari Character.metadata (VF-1.5) — disimpan sebagai Json di
     * Prisma, berisi field PersonaDraft yang tidak punya kolom Prisma langsung.
     */
    metadata: {
        species: string;
        ageDescriptor: string;
        motivation: string | null;
        visualDescription: string;
        personaSource: 'ai-parsed' | 'manual';
    };

    /**
     * Dari CharacterAsset — opsional, tidak semua karakter punya asset
     * (hanya karakter yang sudah lewat Step 3 wizard VF-1.7). Reuse
     * CharacterVisualProfile via Omit supaya tidak divergen kalau
     * CharacterVisualProfile berubah di masa depan.
     */
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;
}

/** Jenis media yang dihasilkan untuk satu shot */
export type MediaAssetType = 'IMAGE' | 'VIDEO_CLIP' | 'AUDIO';

/** Sub-jenis untuk AUDIO (VF-4.1 voiceover, VF-4.3 sfx/bgm) */
export type MediaAssetSubtype = 'VOICEOVER' | 'SFX' | 'BGM';

/** Status siklus hidup satu MediaJob */
export type MediaJobStatus =
    | 'PENDING'
    | 'GENERATING'
    | 'DONE'
    | 'FAILED'
    | 'RETRYING';

/**
 * MediaJob — kontrak untuk job generasi media async (image/video/audio per
 * shot). BEDA dari `GenerationJob` (teks) existing karena job ini berdurasi
 * menit (bukan detik), butuh polling/webhook, retry per-provider dalam
 * fallback chain, dan cost tracking. Dipetakan 1:1 ke Temporal workflow
 * activity (lihat IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-3.5).
 */
export interface MediaJob {
    id: string;

    /** ID VideoProject yang memiliki job ini */
    projectId: string;

    /** Index shot dalam storyboard yang sedang diproses job ini */
    shotIndex: number;

    type: MediaAssetType;

    /** Sub-jenis untuk AUDIO (VOICEOVER/SFX/BGM) — nullable, hanya relevan untuk type AUDIO */
    subtype?: MediaAssetSubtype;

    status: MediaJobStatus;

    /** Nama provider yang SEDANG dipakai, mis. "kling-3.0" — berubah kalau fallback chain aktif */
    providerUsed: string;

    /** Urutan fallback yang sudah dicoba, mis. ["kling-3.0", "seedance-2"] kalau kling gagal lalu pindah ke seedance */
    providerAttempts: string[];

    /** Jumlah percobaan retry yang sudah dilakukan untuk attempt SAAT INI (provider yang sedang aktif) */
    retryCount: number;

    /** URL asset hasil generate, terisi setelah status === 'DONE' */
    resultUrl?: string;

    /** Estimasi/aktual biaya job ini dalam USD */
    cost?: number;

    /** Pesan error terakhir, kalau status === 'FAILED' */
    lastError?: string;

    /** Metadata tambahan per subtype: VOICEOVER={characterId,dialogueText,voiceId}, SFX={sfxType,duration}, BGM={mood,duration} */
    metadata?: Record<string, unknown>;

    createdAt: string;
    updatedAt: string;
}

/** Preset platform target — menentukan resolusi, safe zone, dan encode spec */
export type PlatformTarget = 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS';

/**
 * ShotSpec — satu shot dalam storyboard. Dihasilkan oleh
 * `storyboard/scene-breakdown.ts` (VF-2.5), dikonsumsi oleh
 * `visual/image-generator.ts` dan `motion/animation-generator.ts` (VF-3).
 */
export interface ShotSpec {
    /** Index urutan shot dalam video (0-based) */
    index: number;

    /** Sudut kamera, mis. "close-up", "wide shot", "over-the-shoulder" */
    cameraAngle: string;

    /** Durasi shot dalam detik */
    duration: number;

    /** Dialog karakter di shot ini, kosong kalau tidak ada dialog */
    dialogue?: {
        characterId: string;
        line: string;
    };

    /** Deskripsi aksi/kejadian di shot ini */
    action: string;

    /** Prompt siap pakai untuk image/video generator, dibangun dari action + reference visual karakter */
    visualPrompt: string;

    /** Prompt tambahan khusus untuk motion generator (arah gerak kamera/karakter), opsional — kalau kosong pakai default camera-motion preset */
    motionPrompt?: string;
}

/**
 * VideoAsset — metadata output video final. Dipetakan ke model Prisma
 * `VideoRender`.
 * 
 * @deprecated Gunakan `VideoRender` yang lebih lengkap (include status, width/height, renderJobs)
 * VideoAsset dipertahankan untuk backward compat dengan kode existing.
 */
export interface VideoAsset {
    projectId: string;
    videoUrl: string;
    thumbnailUrl?: string;
    /** Durasi dalam detik */
    duration: number;
    /** Resolusi, mis. "1080x1920" — legacy field, gunakan width/height di VideoRender */
    resolution: string;
    /** @deprecated Gunakan platform array di VideoRender */
    platform: PlatformTarget;
}

/**
 * VideoRender — mirror Prisma model `VideoRender` (VF-4.6).
 * Termasuk status tracking, width/height terpisah untuk query efisien,
 * platform array untuk multi-platform, dan relasi ke VideoRenderJob.
 */
export interface VideoRender {
    id: string;
    projectId: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    duration: number;
    width: number;
    height: number;
    resolution: string;           // legacy/compat display (e.g. "1080x1920")
    platform: PlatformTarget[];   // array untuk multi-platform render
    codec: string;
    fileSizeBytes: bigint | null;
    status: RenderStatus;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
    renderJobs?: VideoRenderJob[];
}

/**
 * VideoRenderJob — tracking percobaan render (mirror Prisma `VideoRenderJob`).
 * Berguna untuk observability: provider mana yang gagal, berapa retry, fallback chain history.
 */
export interface VideoRenderJob {
    id: string;
    renderId: string;
    attemptNumber: number;
    providerUsed: string;
    status: RenderJobStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    error: string | null;
    cost: number | null;
    metadata: Record<string, unknown> | null;
}

/**
 * RenderStatus — status siklus hidup VideoRender.
 */
export type RenderStatus =
    | 'PENDING'
    | 'RENDERING'
    | 'DONE'
    | 'FAILED';

/**
 * RenderJobStatus — status siklus hidup VideoRenderJob (per attempt).
 */
export type RenderJobStatus =
    | 'PENDING'
    | 'RUNNING'
    | 'DONE'
    | 'FAILED'
    | 'CANCELLED';

/**
 * Zod schemas untuk validasi runtime. Dipisah dari `SCHEMAS` di
 * types/index.ts (bukan digabung) supaya perubahan di sini tidak berisiko
 * konflik dengan schema teks yang sudah stabil.
 */
export const VIDEO_SCHEMAS = {
    personaDraft: z.object({
        draftId: z.string().min(1),
        source: z.enum(['ai-parsed', 'manual']),
        name: z
            .string()
            .min(1)
            .max(64)
            .regex(/^[a-z0-9-]+$/, 'name harus lowercase, angka, dan tanda hubung saja'),
        displayName: z.string().min(1).max(128),
        role: z.enum(['PROTAGONIST', 'DEUTERAGONIST', 'SUPPORTING', 'ANTAGONIST', 'NARRATOR']),
        species: z.string().min(1).max(128),
        ageDescriptor: z.string().min(1).max(128),
        description: z.string().min(1).max(1000),
        coreTraits: z.array(z.string().min(1)).min(1).max(10),
        coreWeakness: z.string().min(1).max(500),
        motivation: z.string().max(500).optional(),
        voiceGuide: z.string().min(1).max(1000),
        visualDescription: z.string().min(1).max(1500),
        fieldsNeedingReview: z.array(z.string()),
        rawInput: z.string().max(5000).optional(),
    }),

    characterVisualProfile: z.object({
        characterId: z.string().min(1),
        referenceImages: z.array(z.string().url()),
        styleTags: z.array(z.string()),
        colorPalette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
        negativePrompt: z.string().max(500).optional(),
        voiceProfile: z
            .object({
                provider: z.string().min(1),
                voiceId: z.string().min(1),
                settings: z.record(z.unknown()).optional(),
            })
            .optional(),
    }),

    shotSpec: z.object({
        index: z.number().int().nonnegative(),
        cameraAngle: z.string().min(1),
        duration: z.number().positive().max(20), // per-shot, bukan total video
        dialogue: z
            .object({
                characterId: z.string().min(1),
                line: z.string().min(1),
            })
            .optional(),
        action: z.string().min(1),
        visualPrompt: z.string().min(1),
        motionPrompt: z.string().optional(),
    }),
} as const;