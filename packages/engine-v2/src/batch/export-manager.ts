/**
 * Suro-Buya Engine v2 - Export Manager (VF-5.6 + VF-5.7)
 *
 * Generate metadata siap upload per platform (judul, caption, hashtag) untuk
 * video yang sudah di-export. Metadata ini yang dipakai creator saat upload
 * ke TikTok / YouTube Shorts / Instagram Reels.
 *
 * Fitur:
 * - Generate metadata per platform (judul, caption, hashtag)
 * - Platform-specific formatting (TikTok: hashtag-heavy, YouTube: title-focused, Reels: emoji-heavy)
 * - Hashtag generation dari script/keywords (deterministik, tidak panggil AI)
 * - Caption length validation per platform limit
 * - Multi-platform metadata dalam satu call
 * - Upload batch export ke Cloudflare R2 (VF-5.7)
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-5.6 & VF-5.7:
 * "Generate banyak video sekaligus + metadata (judul, caption, hashtag)"
 * "Zero-egress storage untuk video assets via Cloudflare R2"
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan platform-preset.ts (VF-4.5)
 * dan timeline-builder.ts (VF-4.5).
 */

import type { PlatformTarget } from '@suro-buya/shared';
import { getPlatformPreset } from '../compose/platform-preset.js';
import { R2Storage, R2Paths, type UploadOptions, type UploadResult } from '@suro-buya/shared';

// ============================================================
// Types
// ============================================================

/**
 * Input untuk generate export metadata.
 */
export interface ExportMetadataInput {
    /** Judul project (dari VideoProject.title) */
    title: string;

    /** Script video (dari VideoProject.script) — dipakai untuk extract keywords */
    script: string;

    /** Nama karakter utama (dari Character.displayName) */
    characterName?: string;

    /** Nama series (kalau bagian dari VideoSeries) */
    seriesTitle?: string;

    /** Episode order (kalau bagian dari series) */
    episodeOrder?: number;

    /** Platform targets untuk generate metadata */
    platforms: PlatformTarget[];

    /** Keyword tambahan dari creator (opsional) */
    customKeywords?: string[];

    /** Custom hashtag dari creator (opsional) */
    customHashtags?: string[];
}

/**
 * Metadata siap upload untuk satu platform.
 */
export interface PlatformExportMetadata {
    /** Platform target */
    platform: PlatformTarget;

    /** Judul untuk platform ini (optimized length) */
    title: string;

    /** Caption/description untuk platform ini */
    caption: string;

    /** Hashtag untuk platform ini (tanpa #, array of strings) */
    hashtags: string[];

    /** Hashtag sebagai string (dengan #, comma-separated atau space-separated per platform) */
    hashtagString: string;

    /** Apakah caption melebihi limit platform */
    captionTruncated: boolean;

    /** Warning untuk metadata ini */
    warnings: string[];
}

/**
 * Hasil generate export metadata — multi-platform.
 */
export interface ExportMetadataResult {
    /** Metadata per platform */
    metadata: PlatformExportMetadata[];

    /** Keyword yang di-extract dari script */
    extractedKeywords: string[];

    /** Warning umum */
    warnings: string[];

    /** Ringkasan */
    summary: string;
}

// ============================================================
// Batch Export to R2 (VF-5.7) - Types
// ============================================================

/**
 * Input untuk upload batch export ke R2.
 */
export interface BatchExportUploadInput {
    /** Batch ID */
    batchId: string;
    /** Video files per platform (local file paths) */
    videoFiles: Array<{
        projectId: string;
        platform: PlatformTarget;
        localPath: string;
    }>;
    /** Metadata per platform (dari generateExportMetadata) */
    metadata: PlatformExportMetadata[];
    /** Universe ID untuk path structure */
    universeId: string;
}

/**
 * Hasil upload batch export ke R2.
 */
export interface BatchExportUploadResult {
    /** Batch ID */
    batchId: string;
    /** Upload results per platform */
    uploads: Array<{
        projectId: string;
        platform: PlatformTarget;
        r2Key: string;
        publicUrl?: string;
        presignedUrl: string;
        etag?: string;
        size: number;
        metadata: PlatformExportMetadata;
    }>;
    /** Metadata JSON R2 key */
    metadataR2Key: string;
    /** Metadata JSON presigned URL */
    metadataPresignedUrl: string;
}

// ============================================================
// Platform-specific limits
// ============================================================

/**
 * Limit per platform untuk metadata.
 */
interface PlatformMetadataLimit {
    /** Max karakter judul */
    maxTitleLength: number;

    /** Max karakter caption/description */
    maxCaptionLength: number;

    /** Max jumlah hashtag */
    maxHashtagCount: number;

    /** Max karakter per hashtag */
    maxHashtagLength: number;

    /** Format hashtag: "space" (TikTok) atau "comma" (YouTube) */
    hashtagFormat: 'space' | 'comma';

    /** Gaya caption: "hashtag-heavy", "title-focused", "emoji-heavy" */
    captionStyle: 'hashtag-heavy' | 'title-focused' | 'emoji-heavy';
}

/**
 * Limit per platform.
 */
const PLATFORM_METADATA_LIMITS: Record<PlatformTarget, PlatformMetadataLimit> = {
    TIKTOK: {
        maxTitleLength: 100,
        maxCaptionLength: 2200,
        maxHashtagCount: 30,
        maxHashtagLength: 100,
        hashtagFormat: 'space',
        captionStyle: 'hashtag-heavy',
    },
    YOUTUBE_SHORTS: {
        maxTitleLength: 100,
        maxCaptionLength: 5000,
        maxHashtagCount: 15,
        maxHashtagLength: 100,
        hashtagFormat: 'comma',
        captionStyle: 'title-focused',
    },
    INSTAGRAM_REELS: {
        maxTitleLength: 125,
        maxCaptionLength: 2200,
        maxHashtagCount: 30,
        maxHashtagLength: 100,
        hashtagFormat: 'space',
        captionStyle: 'emoji-heavy',
    },
};

// ============================================================
// Keyword Extraction (deterministik)
// ============================================================

/**
 * Stop words Indonesia yang tidak berguna sebagai hashtag.
 */
const STOP_WORDS_ID = new Set([
    'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'atau', 'ini', 'itu',
    'adalah', 'akan', 'tidak', 'juga', 'pada', 'saya', 'kamu', 'dia', 'mereka',
    'kita', 'kami', 'ada', 'tidak', 'bukan', 'jangan', 'sudah', 'belum', 'lagi',
    'sangat', 'lebih', 'paling', 'seperti', 'karena', 'kalau', 'jika', 'tetapi',
    'namun', 'sehingga', 'supaya', 'agar', 'oleh', 'tentang', 'tanpa', 'setelah',
    'sebelum', 'saat', 'ketika', 'sekarang', 'nanti', 'kemudian', 'lalu', 'terus',
    'hanya', 'masih', 'bisa', 'boleh', 'harus', 'perlu', 'mau', 'ingin',
    'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
    'adalah', 'ialah', 'itu', 'ini', 'tersebut', 'demikian', 'begitu',
    'ya', 'tidak', 'baik', 'buruk', 'besar', 'kecil', 'tinggi', 'rendah',
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'on', 'at',
    'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down',
]);

/**
 * Extract keywords dari script (deterministik, tidak panggil AI).
 * Algoritma: tokenisasi → filter stop words → frequency count → top N.
 *
 * @param script Script video
 * @param maxKeywords Max keyword yang di-extract (default: 10)
 * @returns Array keyword (lowercase, sorted by frequency)
 */
export function extractKeywordsFromScript(
    script: string,
    maxKeywords: number = 10,
): string[] {
    // Tokenisasi: split by non-alphanumeric, filter empty
    const tokens = script
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOP_WORDS_ID.has(t));

    // Frequency count
    const frequency = new Map<string, number>();
    for (const token of tokens) {
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }

    // Sort by frequency (desc), then alphabetically
    const sorted = Array.from(frequency.entries())
        .sort((a, b) => {
            const freqDiff = b[1] - a[1];
            if (freqDiff !== 0) return freqDiff;
            return a[0].localeCompare(b[0]);
        });

    // Take top N
    return sorted.slice(0, maxKeywords).map(([word]) => word);
}

// ============================================================
// Hashtag Generation
// ============================================================

/**
 * Generate hashtag dari keywords + custom hashtags.
 *
 * @param keywords Keywords yang di-extract dari script
 * @param customHashtags Custom hashtag dari creator
 * @param characterName Nama karakter (dipakai sebagai hashtag kalau ada)
 * @param seriesTitle Nama series (dipakai sebagai hashtag kalau ada)
 * @param maxCount Max hashtag count
 * @returns Array hashtag (tanpa #, lowercase, unique)
 */
export function generateHashtags(
    keywords: string[],
    customHashtags: string[] = [],
    characterName?: string,
    seriesTitle?: string,
    maxCount: number = 15,
): string[] {
    const hashtags: string[] = [];

    // Add character name as hashtag (priority)
    if (characterName) {
        const charTag = characterName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();
        if (charTag.length > 0) {
            hashtags.push(charTag);
        }
    }

    // Add series title as hashtag
    if (seriesTitle) {
        const seriesTag = seriesTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();
        if (seriesTag.length > 0 && !hashtags.includes(seriesTag)) {
            hashtags.push(seriesTag);
        }
    }

    // Add custom hashtags
    for (const custom of customHashtags) {
        const tag = custom
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();
        if (tag.length > 0 && !hashtags.includes(tag)) {
            hashtags.push(tag);
        }
    }

    // Add keywords as hashtags
    for (const keyword of keywords) {
        const tag = keyword.replace(/[^a-z0-9]+/g, '').trim();
        if (tag.length > 0 && !hashtags.includes(tag)) {
            hashtags.push(tag);
        }
    }

    // Add platform-generic hashtags
    const genericTags = ['shortvideo', 'viral', 'fyp', 'foryou'];
    for (const tag of genericTags) {
        if (!hashtags.includes(tag) && hashtags.length < maxCount) {
            hashtags.push(tag);
        }
    }

    // Limit to maxCount
    return hashtags.slice(0, maxCount);
}

// ============================================================
// Caption Generation
// ============================================================

/**
 * Generate caption untuk platform target.
 *
 * @param input Input metadata
 * @param platform Platform target
 * @param hashtags Hashtag untuk platform ini
 * @param limit Platform limit
 * @returns Caption + truncated flag + warnings
 */
function generateCaption(
    input: ExportMetadataInput,
    platform: PlatformTarget,
    hashtags: string[],
    limit: PlatformMetadataLimit,
): { caption: string; truncated: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const parts: string[] = [];

    // Title at the beginning
    parts.push(input.title);

    // Episode info (kalau bagian series)
    if (input.seriesTitle && input.episodeOrder) {
        parts.push(`Episode ${input.episodeOrder} dari series "${input.seriesTitle}"`);
    }

    // Character mention
    if (input.characterName) {
        parts.push(`Menampilkan ${input.characterName}`);
    }

    // Platform-specific style
    if (limit.captionStyle === 'emoji-heavy') {
        // Instagram Reels: add emoji
        parts.push('🎬✨');
    } else if (limit.captionStyle === 'hashtag-heavy') {
        // TikTok: hashtag akan ditambahkan di akhir
    } else if (limit.captionStyle === 'title-focused') {
        // YouTube: description lebih detail
        parts.push('Tonton sampai habis! Jangan lupa subscribe untuk episode selanjutnya.');
    }

    // Hashtag string
    const hashtagString = formatHashtagString(hashtags, limit.hashtagFormat);
    if (hashtagString) {
        parts.push(hashtagString);
    }

    let caption = parts.join('\n\n');

    // Truncate if exceeds limit
    let truncated = false;
    if (caption.length > limit.maxCaptionLength) {
        truncated = true;
        const truncatedCaption = caption.substring(0, limit.maxCaptionLength - 3) + '...';
        warnings.push(
            `Caption truncated from ${caption.length} to ${limit.maxCaptionLength} characters for ${platform}.`,
        );
        caption = truncatedCaption;
    }

    return { caption, truncated, warnings };
}

/**
 * Format hashtag array menjadi string per platform format.
 */
function formatHashtagString(
    hashtags: string[],
    format: 'space' | 'comma',
): string {
    if (hashtags.length === 0) return '';

    if (format === 'space') {
        // TikTok/Reels: #hashtag1 #hashtag2 #hashtag3
        return hashtags.map((h) => `#${h}`).join(' ');
    } else {
        // YouTube: #hashtag1, #hashtag2, #hashtag3
        return hashtags.map((h) => `#${h}`).join(', ');
    }
}

// ============================================================
// Title Generation
// ============================================================

/**
 * Generate title untuk platform target.
 *
 * @param input Input metadata
 * @param platform Platform target
 * @param limit Platform limit
 * @returns Title + warnings
 */
function generateTitle(
    input: ExportMetadataInput,
    platform: PlatformTarget,
    limit: PlatformMetadataLimit,
): { title: string; warnings: string[] } {
    const warnings: string[] = [];
    let title = input.title;

    // Add episode info to title (kalau bagian series)
    if (input.seriesTitle && input.episodeOrder) {
        const episodeSuffix = ` — Ep ${input.episodeOrder}`;
        if (title.length + episodeSuffix.length <= limit.maxTitleLength) {
            title = `${title}${episodeSuffix}`;
        }
    }

    // Truncate if exceeds limit
    if (title.length > limit.maxTitleLength) {
        warnings.push(
            `Title truncated from ${title.length} to ${limit.maxTitleLength} characters for ${platform}.`,
        );
        title = title.substring(0, limit.maxTitleLength - 3) + '...';
    }

    return { title, warnings };
}

// ============================================================
// Main — Generate Export Metadata
// ============================================================

/**
 * Generate metadata siap upload untuk multiple platform.
 *
 * @param input Title + script + character + series + platforms
 * @returns Metadata per platform + extracted keywords
 */
export function generateExportMetadata(
    input: ExportMetadataInput,
): ExportMetadataResult {
    const warnings: string[] = [];

    // Validate input
    if (!input.title || input.title.trim().length === 0) {
        warnings.push('Title is empty — metadata will be incomplete.');
    }

    if (!input.platforms || input.platforms.length === 0) {
        warnings.push('No platforms specified — returning empty metadata.');
        return {
            metadata: [],
            extractedKeywords: [],
            warnings,
            summary: 'No metadata generated — no platforms specified.',
        };
    }

    // Extract keywords from script
    const extractedKeywords = input.script
        ? extractKeywordsFromScript(input.script)
        : [];

    // Generate metadata per platform
    const metadata: PlatformExportMetadata[] = input.platforms.map((platform) => {
        const limit = PLATFORM_METADATA_LIMITS[platform];

        // Generate hashtags for this platform
        const hashtags = generateHashtags(
            extractedKeywords,
            input.customHashtags,
            input.characterName,
            input.seriesTitle,
            limit.maxHashtagCount,
        );

        // Generate title
        const { title, warnings: titleWarnings } = generateTitle(input, platform, limit);

        // Generate caption
        const { caption, truncated, warnings: captionWarnings } = generateCaption(
            input,
            platform,
            hashtags,
            limit,
        );

        const allWarnings = [...titleWarnings, ...captionWarnings];

        return {
            platform,
            title,
            caption,
            hashtags,
            hashtagString: formatHashtagString(hashtags, limit.hashtagFormat),
            captionTruncated: truncated,
            warnings: allWarnings,
        };
    });

    // Collect all warnings
    for (const m of metadata) {
        warnings.push(...m.warnings);
    }

    // Summary
    const platformList = input.platforms.join(', ');
    const summary = `Generated metadata for ${input.platforms.length} platform(s): ${platformList}. ${extractedKeywords.length} keywords extracted.`;

    return {
        metadata,
        extractedKeywords,
        warnings,
        summary,
    };
}

// ============================================================
// Helper — Get Platform Metadata Limit
// ============================================================

/**
 * Dapatkan limit metadata untuk platform target.
 *
 * @param platform Platform target
 * @returns Platform metadata limit
 */
export function getPlatformMetadataLimit(platform: PlatformTarget): PlatformMetadataLimit {
    return PLATFORM_METADATA_LIMITS[platform];
}

// ============================================================
// Helper — Validate Metadata
// ============================================================

/**
 * Validasi metadata untuk platform target.
 *
 * @param metadata Metadata yang akan divalidasi
 * @returns Array error message (kosong kalau valid)
 */
export function validateExportMetadata(
    metadata: PlatformExportMetadata,
): string[] {
    const errors: string[] = [];
    const limit = PLATFORM_METADATA_LIMITS[metadata.platform];

    if (metadata.title.length > limit.maxTitleLength) {
        errors.push(
            `Title exceeds ${metadata.platform} limit: ${metadata.title.length}/${limit.maxTitleLength} characters.`,
        );
    }

    if (metadata.caption.length > limit.maxCaptionLength) {
        errors.push(
            `Caption exceeds ${metadata.platform} limit: ${metadata.caption.length}/${limit.maxCaptionLength} characters.`,
        );
    }

    if (metadata.hashtags.length > limit.maxHashtagCount) {
        errors.push(
            `Hashtag count exceeds ${metadata.platform} limit: ${metadata.hashtags.length}/${limit.maxHashtagCount}.`,
        );
    }

    for (const hashtag of metadata.hashtags) {
        if (hashtag.length > limit.maxHashtagLength) {
            errors.push(
                `Hashtag "#${hashtag}" exceeds ${metadata.platform} length limit: ${hashtag.length}/${limit.maxHashtagLength}.`,
            );
        }
    }

    return errors;
}

// ============================================================
// Batch Export to R2 (VF-5.7) - Implementation
// ============================================================

/**
 * Upload batch export videos + metadata ke Cloudflare R2 (VF-5.7).
 * 
 * Struktur R2:
 * - batch/{batchId}/{projectId}-{platform}.mp4 (video files)
 * - batch/{batchId}/metadata.json (combined metadata for all platforms)
 *
 * @param input Batch export upload input
 * @param r2Config R2 configuration (optional, will use env if not provided)
 * @returns Upload results dengan presigned URLs
 */
export async function uploadBatchExportToR2(
    input: BatchExportUploadInput,
    r2Config?: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicUrl?: string; presignedTtlSeconds?: number }
): Promise<BatchExportUploadResult> {
    // Initialize R2 client
    const r2 = r2Config 
        ? new R2Storage(r2Config)
        : await createR2StorageFromEnvOrThrow();

    const fs = await import('node:fs/promises');
    const uploads: BatchExportUploadResult['uploads'] = [];

    // Upload each video file
    for (const videoFile of input.videoFiles) {
        const { projectId, platform, localPath } = videoFile;
        const platformMetadata = input.metadata.find(m => m.platform === platform);
        
        if (!platformMetadata) {
            throw new Error(`Metadata not found for platform: ${platform}`);
        }

        // Read file
        const fileBuffer = await fs.readFile(localPath);
        const size = fileBuffer.length;

        // Generate R2 key using path helper
        const r2Key = R2Paths.batchVideo(input.batchId, projectId, platform);

        // Upload to R2
        const uploadOptions: UploadOptions = {
            contentType: 'video/mp4',
            cacheControl: 'public, max-age=31536000, immutable',
            metadata: {
                projectId,
                platform,
                batchId: input.batchId,
                title: platformMetadata.title,
                hashtags: platformMetadata.hashtags.join(','),
            },
        };

        const result = await r2.upload(r2Key, fileBuffer, uploadOptions);
        
        // Generate presigned download URL
        const presignedUrl = await r2.getPresignedDownloadUrl(r2Key);

        uploads.push({
            projectId,
            platform,
            r2Key: result.key,
            publicUrl: result.publicUrl,
            presignedUrl,
            etag: result.etag,
            size: result.size,
            metadata: platformMetadata,
        });
    }

    // Upload combined metadata JSON
    const metadataR2Key = R2Paths.batchMetadata(input.batchId);
    const metadataJson = JSON.stringify({
        batchId: input.batchId,
        universeId: input.universeId,
        uploadedAt: new Date().toISOString(),
        platforms: uploads.map(u => ({
            projectId: u.projectId,
            platform: u.platform,
            r2Key: u.r2Key,
            publicUrl: u.publicUrl,
            presignedUrl: u.presignedUrl,
            etag: u.etag,
            size: u.size,
            metadata: u.metadata,
        })),
    }, null, 2);

    const metadataUploadResult = await r2.upload(metadataR2Key, metadataJson, {
        contentType: 'application/json',
        cacheControl: 'public, max-age=3600', // 1 hour cache for metadata
    });

    const metadataPresignedUrl = await r2.getPresignedDownloadUrl(metadataR2Key);

    return {
        batchId: input.batchId,
        uploads,
        metadataR2Key: metadataUploadResult.key,
        metadataPresignedUrl,
    };
}

/**
 * Create R2Storage from environment variables or throw if not configured.
 */
async function createR2StorageFromEnvOrThrow(): Promise<R2Storage> {
    const env = process.env as Record<string, string | undefined>;
    const accountId = env['R2_ACCOUNT_ID'];
    const accessKeyId = env['R2_ACCESS_KEY_ID'];
    const secretAccessKey = env['R2_SECRET_ACCESS_KEY'];
    const bucket = env['R2_BUCKET'];
    const publicUrl = env['R2_PUBLIC_URL'];
    const presignedTtlSeconds = env['R2_PRESIGNED_TTL_SECONDS']
        ? parseInt(env['R2_PRESIGNED_TTL_SECONDS']!, 10)
        : undefined;

    const missing: string[] = [];
    if (!accountId) missing.push('R2_ACCOUNT_ID');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!bucket) missing.push('R2_BUCKET');

    if (missing.length > 0) {
        throw new Error(
            `Missing required R2 environment variables: ${missing.join(', ')}. ` +
            `Please configure R2 for batch export upload (VF-5.7).`,
        );
    }

    return new R2Storage({
        accountId: accountId!,
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
        bucket: bucket!,
        publicUrl,
        presignedTtlSeconds,
    });
}