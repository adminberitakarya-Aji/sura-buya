/**
 * Suro-Buya Video Worker — Configuration (VF-3.5)
 *
 * Membaca konfigurasi dari environment variables. Berbeda dari engine-v2
 * (yang tidak pernah baca env langsung — pola sejak VF-1.5), video-worker
 * adalah aplikasi server (bukan library) sehingga membaca env di sini
 * adalah tempat yang tepat — sama seperti apps/web/src/lib/prisma.ts.
 *
 * Temporal:
 * - TEMPORAL_ADDRESS: alamat Temporal server (default: localhost:7233 untuk dev lokal)
 * - TEMPORAL_NAMESPACE: namespace Temporal (default: "default")
 * - TEMPORAL_TASK_QUEUE: task queue name (default: "video-media-queue")
 * - TEMPORAL_CLIENT_CERT_PATH / TEMPORAL_CLIENT_KEY_PATH: mTLS untuk production
 *
 * Media Provider API Keys:
 * - FAL_API_KEY: API key untuk fal.ai (Kling 3.0, Seedance 2, Wan 2.7, Flux 2 Pro)
 * - GEMINI_API_KEY: API key untuk Google Gemini (Nano Banana 2)
 *
 * Database:
 * - DATABASE_URL: Postgres connection string (sama seperti apps/web)
 */

/**
 * Konfigurasi Temporal server.
 */
export interface TemporalConfig {
    /** Alamat Temporal server, mis. "localhost:7233" */
    address: string;
    /** Namespace Temporal, mis. "default" */
    namespace: string;
    /** Task queue name untuk video media jobs */
    taskQueue: string;
    /** Path ke client certificate untuk mTLS (production). Kosong = tanpa TLS. */
    clientCertPath?: string;
    /** Path ke client key untuk mTLS (production). Kosong = tanpa TLS. */
    clientKeyPath?: string;
}

/**
 * Konfigurasi media provider API keys.
 * Dipakai oleh lib/provider-setup.ts untuk membangun MediaProviderRegistry
 * dengan provider nyata (VF-3.1 image, VF-3.3 video).
 */
export interface MediaProviderKeyConfig {
    /** API key untuk fal.ai — dipakai Kling 3.0, Seedance 2, Wan 2.7, Flux 2 Pro */
    falApiKey?: string;
    /** API key untuk Google Gemini — dipakai Nano Banana 2 */
    geminiApiKey?: string;
    /** API key untuk ElevenLabs — dipakai TTS voice synthesis (VF-4.1) */
    elevenlabsApiKey?: string;
    /** API key untuk Cartesia — dipakai TTS voice synthesis fallback (VF-4.1) */
    cartesiaApiKey?: string;
    /** Base URL untuk IndoTTS — self-hosted TTS (VF-4.1) */
    indoTtsBaseUrl?: string;
    /** API key untuk IndoTTS — opsional untuk self-hosted (VF-4.1) */
    indoTtsApiKey?: string;
}

/**
 * Konfigurasi lengkap video-worker.
 */
export interface WorkerConfig {
    temporal: TemporalConfig;
    mediaProviders: MediaProviderKeyConfig;
    /** Database URL — sama seperti apps/web, dipakai Prisma client */
    databaseUrl: string;
    /**
     * Max retry attempts per provider sebelum fallback ke provider berikutnya.
     * Default: 3 (sesuai retry policy Temporal yang reasonable untuk media gen).
     */
    maxRetryAttempts: number;
    /**
     * Initial retry backoff dalam ms. Temporal menggunakan exponential backoff.
     * Default: 1000 (1 detik) — media gen gagal biasanya transient (rate limit, network).
     */
    initialRetryBackoffMs: number;
    /**
     * Max retry backoff dalam ms. Default: 30000 (30 detik).
     */
    maxRetryBackoffMs: number;
}

/**
 * Baca konfigurasi dari environment variables.
 * Throw kalau DATABASE_URL tidak ada (wajib untuk Prisma).
 */
export function loadConfig(): WorkerConfig {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
        throw new Error(
            'DATABASE_URL environment variable is required — video-worker needs Prisma access to MediaAsset table',
        );
    }

    const temporalAddress =
        process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';
    const temporalNamespace =
        process.env['TEMPORAL_NAMESPACE'] ?? 'default';
    const temporalTaskQueue =
        process.env['TEMPORAL_TASK_QUEUE'] ?? 'video-media-queue';

    const clientCertPath = process.env['TEMPORAL_CLIENT_CERT_PATH'];
    const clientKeyPath = process.env['TEMPORAL_CLIENT_KEY_PATH'];

    return {
        temporal: {
            address: temporalAddress,
            namespace: temporalNamespace,
            taskQueue: temporalTaskQueue,
            clientCertPath: clientCertPath || undefined,
            clientKeyPath: clientKeyPath || undefined,
        },
        mediaProviders: {
            falApiKey: process.env['FAL_API_KEY'] || undefined,
            geminiApiKey: process.env['GEMINI_API_KEY'] || undefined,
        },
        databaseUrl,
        maxRetryAttempts: parseInt(
            process.env['MEDIA_JOB_MAX_RETRIES'] ?? '3',
            10,
        ),
        initialRetryBackoffMs: parseInt(
            process.env['MEDIA_JOB_INITIAL_BACKOFF_MS'] ?? '1000',
            10,
        ),
        maxRetryBackoffMs: parseInt(
            process.env['MEDIA_JOB_MAX_BACKOFF_MS'] ?? '30000',
            10,
        ),
    };
}

/**
 * Default retry policy untuk activities — dipakai di workflow.
 * Sesuai acceptance criteria VF-3.5: "retry policy, resume-on-crash".
 *
 * Temporal retry policy:
 * - maximumAttempts: berapa kali activity di-retry sebelum dianggap gagal
 * - initialInterval: backoff awal
 * - maximumInterval: cap backoff (exponential growth berhenti di sini)
 * - backoffCoefficient: 2.0 = exponential doubling
 */
export const DEFAULT_RETRY_POLICY = {
    maximumAttempts: 3,
    initialInterval: 1000, // 1 detik
    maximumInterval: 30000, // 30 detik
    backoffCoefficient: 2.0,
} as const;

/**
 * Default activity options — dipakai di workflow.
 * startToCloseTimeout: 5 menit (media gen bisa lambat, lihat VF-3.3 timeout 300000ms)
 * retryOnNonRetryable: false — retry semua error (media provider error bisa transient)
 */
export const DEFAULT_ACTIVITY_OPTIONS = {
    startToCloseTimeout: '5 minutes',
    retry: DEFAULT_RETRY_POLICY,
} as const;