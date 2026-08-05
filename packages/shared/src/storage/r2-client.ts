/**
 * @suro-buya/shared - R2 Storage Client (VF-5.7)
 *
 * S3-compatible client untuk Cloudflare R2. Zero-egress storage untuk video assets.
 * Menggunakan @aws-sdk/client-s3 dengan endpoint R2.
 *
 * Konfigurasi via environment variables:
 * - R2_ACCOUNT_ID: Cloudflare Account ID
 * - R2_ACCESS_KEY_ID: R2 Access Key ID
 * - R2_SECRET_ACCESS_KEY: R2 Secret Access Key
 * - R2_BUCKET: Bucket name (per-environment: suro-buya-dev, suro-buya-staging, suro-buya-prod)
 * - R2_PUBLIC_URL: Optional custom domain (e.g., https://cdn.suro-buya.com) atau default pub-xxx.r2.dev
 * - R2_PRESIGNED_TTL_SECONDS: Presigned URL TTL in seconds (default: 3600 = 1 hour)
 */

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    CreateBucketCommand,
    HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface R2Config {
    /** Cloudflare Account ID */
    accountId: string;
    /** R2 Access Key ID */
    accessKeyId: string;
    /** R2 Secret Access Key */
    secretAccessKey: string;
    /** Bucket name */
    bucket: string;
    /** Optional custom domain (e.g., https://cdn.suro-buya.com) atau default pub-xxx.r2.dev */
    publicUrl?: string;
    /** Presigned URL TTL in seconds (default: 3600 = 1 hour) */
    presignedTtlSeconds?: number;
}

/**
 * Upload options
 */
export interface UploadOptions {
    /** Content-Type header */
    contentType: string;
    /** Cache-Control header (optional) */
    cacheControl?: string;
    /** Custom metadata (optional) */
    metadata?: Record<string, string>;
}

/**
 * Upload result
 */
export interface UploadResult {
    /** Object key in bucket */
    key: string;
    /** Public URL (if publicUrl configured) */
    publicUrl?: string;
    /** ETag dari R2 */
    etag?: string;
    /** File size in bytes */
    size: number;
}

/**
 * Object metadata dari HEAD request
 */
export interface ObjectMetadata {
    /** Object key */
    key: string;
    /** File size in bytes */
    size: number;
    /** Content-Type */
    contentType: string;
    /** ETag */
    etag?: string;
    /** Last modified */
    lastModified?: Date;
}

/**
 * R2Storage - S3-compatible client untuk Cloudflare R2
 *
 * Usage:
 * ```typescript
 * const r2 = new R2Storage({
 *     accountId: process.env.R2_ACCOUNT_ID!,
 *     accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
 *     bucket: process.env.R2_BUCKET!,
 *     publicUrl: process.env.R2_PUBLIC_URL, // optional
 *     presignedTtlSeconds: 3600,
 * });
 *
 * const result = await r2.upload('renders/project1/video.mp4', fileBuffer, { contentType: 'video/mp4' });
 * const downloadUrl = await r2.getPresignedDownloadUrl('renders/project1/video.mp4');
 * ```
 */
export class R2Storage {
    private readonly client: S3Client;
    private readonly bucket: string;
    private readonly publicUrl?: string;
    private readonly presignedTtlSeconds: number;

    constructor(config: R2Config) {
        this.bucket = config.bucket;
        this.publicUrl = config.publicUrl;
        this.presignedTtlSeconds = config.presignedTtlSeconds ?? 3600;

        // R2 endpoint format: https://<account-id>.r2.cloudflarestorage.com
        const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;

        this.client = new S3Client({
            region: 'auto',
            endpoint,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }

    /**
     * Upload file ke R2
     *
     * @param key Object key (path dalam bucket, e.g., 'renders/project1/video.mp4')
     * @param body File content (Buffer, Readable stream, atau string)
     * @param options Upload options (contentType wajib)
     * @returns UploadResult dengan key, publicUrl, etag, size
     */
    async upload(
        key: string,
        body: Buffer | Readable | string,
        options: UploadOptions,
    ): Promise<UploadResult> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: options.contentType,
            CacheControl: options.cacheControl ?? 'public, max-age=31536000, immutable',
            Metadata: options.metadata,
        });

        const response = await this.client.send(command);

        const size = typeof body === 'string'
            ? Buffer.byteLength(body, 'utf-8')
            : body instanceof Buffer
                ? body.length
                : 0; // stream size unknown, will be in response if available

        return {
            key,
            publicUrl: this.publicUrl ? `${this.publicUrl}/${key}` : undefined,
            etag: response.ETag?.replace(/"/g, ''),
            size,
        };
    }

    /**
     * Generate presigned URL untuk download (private bucket access)
     *
     * @param key Object key
     * @param expiresInSeconds Optional override TTL (default: config.presignedTtlSeconds)
     * @returns Signed URL valid untuk durasi yang ditentukan
     */
    async getPresignedDownloadUrl(
        key: string,
        expiresInSeconds?: number,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        return getSignedUrl(this.client, command, {
            expiresIn: expiresInSeconds ?? this.presignedTtlSeconds,
        });
    }

    /**
     * Generate presigned URL untuk upload (client-side direct upload)
     *
     * @param key Object key
     * @param contentType Content-Type yang akan di-upload
     * @param expiresInSeconds Optional override TTL
     * @returns Signed URL untuk PUT object
     */
    async getPresignedUploadUrl(
        key: string,
        contentType: string,
        expiresInSeconds?: number,
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
        });

        return getSignedUrl(this.client, command, {
            expiresIn: expiresInSeconds ?? this.presignedTtlSeconds,
        });
    }

    /**
     * Delete object dari R2
     *
     * @param key Object key
     */
    async delete(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.client.send(command);
    }

    /**
     * Get object metadata (HEAD request - tidak download file)
     *
     * @param key Object key
     * @returns ObjectMetadata atau null kalau tidak ditemukan
     */
    async head(key: string): Promise<ObjectMetadata | null> {
        const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        try {
            const response = await this.client.send(command);
            return {
                key,
                size: response.ContentLength ?? 0,
                contentType: response.ContentType ?? 'application/octet-stream',
                etag: response.ETag?.replace(/"/g, ''),
                lastModified: response.LastModified,
            };
        } catch (error) {
            // Not found = 404
            if (error instanceof Error && error.name === 'NotFound') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Check apakah object exists
     */
    async exists(key: string): Promise<boolean> {
        const meta = await this.head(key);
        return meta !== null;
    }

    /**
     * Get public URL untuk object (kalau publicUrl dikonfigurasi)
     */
    getPublicUrl(key: string): string | undefined {
        if (!this.publicUrl) return undefined;
        return `${this.publicUrl}/${key}`;
    }

    /**
     * Get bucket name
     */
    getBucket(): string {
        return this.bucket;
    }
}

/**
 * Factory function untuk create R2Storage dari environment variables.
 * Throw kalau required env tidak ada.
 */
export function createR2StorageFromEnv(): R2Storage {
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
            `Please check your .env file.`,
        );
    }

    // At this point all required vars are guaranteed to be defined
    return new R2Storage({
        accountId: accountId!,
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
        bucket: bucket!,
        publicUrl,
        presignedTtlSeconds,
    });
}

/**
 * Bucket path helpers untuk struktur yang konsisten
 */
export const R2Paths = {
    /** Render output: renders/{universeId}/{projectId}/{renderId}.mp4 */
    renderVideo: (universeId: string, projectId: string, renderId: string, ext: string = 'mp4') =>
        `renders/${universeId}/${projectId}/${renderId}.${ext}`,

    /** Render thumbnail: renders/{universeId}/{projectId}/{renderId}-thumb.jpg */
    renderThumbnail: (universeId: string, projectId: string, renderId: string) =>
        `renders/${universeId}/${projectId}/${renderId}-thumb.jpg`,

    /** Batch export: batch/{batchId}/{projectId}-{platform}.mp4 */
    batchVideo: (batchId: string, projectId: string, platform: string, ext: string = 'mp4') =>
        `batch/${batchId}/${projectId}-${platform}.${ext}`,

    /** Batch metadata: batch/{batchId}/metadata.json */
    batchMetadata: (batchId: string) =>
        `batch/${batchId}/metadata.json`,

    /** Temporary files: temp/{random}.{ext} - auto-deleted via lifecycle rule */
    temp: (filename: string) =>
        `temp/${filename}`,

    /** Character reference images: characters/{characterId}/reference-{index}.jpg */
    characterReference: (characterId: string, index: number) =>
        `characters/${characterId}/reference-${index}.jpg`,
} as const;