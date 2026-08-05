/**
 * Suro-Buya Engine v2 - Batch Orchestrator (VF-5.6)
 *
 * Generate banyak video sekaligus. Menerima list of project IDs yang sudah
 * REVIEWED (lolos canon + safety), lalu trigger export untuk masing-masing
 * via callback (caller inject — engine-v2 tidak akses Temporal/DB langsung,
 * pola yang sama sejak VF-1.5).
 *
 * Fitur:
 * - Sequential mode (default, aman dari rate limit) dan parallel mode
 *   (configurable concurrency, default 3)
 * - Progress tracking per project (PENDING → EXPORTING → DONE/FAILED)
 * - Cost tracking total batch
 * - Skip projects yang belum REVIEWED (prerequisite check)
 * - Retry individual failed projects
 * - Cancel batch mid-process
 *
 * Sesuai IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-5.6:
 * "Generate banyak video sekaligus + metadata (judul, caption, hashtag)"
 *
 * PENTING: modul ini murni fungsi async orchestrator — tidak panggil AI
 * provider, tidak akses database, tidak render video. Semua side-effect
 * (Temporal workflow start, DB update) terjadi via callback yang di-inject
 * caller. Pola yang sama dengan image-generator.ts (VF-3.2) dan
 * animation-generator.ts (VF-3.4).
 */

import type { PlatformTarget } from '@suro-buya/shared';

// ============================================================
// Types
// ============================================================

/**
 * Status satu project dalam batch.
 */
export type BatchItemStatus =
    | 'PENDING'      // belum mulai
    | 'EXPORTING'    // sedang di-export
    | 'DONE'         // selesai, videoUrl terisi
    | 'FAILED'       // gagal, error terisi
    | 'SKIPPED'      // di-skip (belum REVIEWED atau prerequisite tidak terpenuhi)
    | 'CANCELLED';   // di-cancel karena batch di-cancel mid-process

/**
 * Satu item dalam batch — satu project yang akan di-export.
 */
export interface BatchItem {
    /** ID VideoProject */
    projectId: string;

    /** Judul project (untuk display) */
    title: string;

    /** Platform targets untuk export project ini */
    platforms: PlatformTarget[];

    /** Status item */
    status: BatchItemStatus;

    /** URL video hasil export (terisi setelah DONE) */
    videoUrl?: string;

    /** URL thumbnail (terisi setelah DONE) */
    thumbnailUrl?: string;

    /** Error message (terisi kalau FAILED) */
    error?: string;

    /** Cost export project ini dalam USD */
    cost?: number;

    /** Durasi video dalam detik */
    duration?: number;

    /** Waktu mulai export (ISO string) */
    startedAt?: string;

    /** Waktu selesai export (ISO string) */
    completedAt?: string;
}

/**
 * Input untuk batch orchestrator.
 */
export interface BatchOrchestratorInput {
    /** Items yang akan di-export */
    items: BatchItemInput[];

    /** Mode: sequential (default) atau parallel */
    mode?: 'sequential' | 'parallel';

    /** Max concurrency untuk parallel mode (default: 3) */
    maxConcurrency?: number;

    /** Apakah skip project yang belum REVIEWED (default: true) */
    skipNotReviewed?: boolean;
}

/**
 * Input untuk satu item batch.
 */
export interface BatchItemInput {
    /** ID VideoProject */
    projectId: string;

    /** Judul project */
    title: string;

    /** Platform targets */
    platforms: PlatformTarget[];

    /** Apakah project sudah REVIEWED (prerequisite check) */
    isReviewed: boolean;
}

/**
 * Callback untuk export satu project.
 * Caller inject fungsi ini — engine-v2 tidak akses Temporal/DB langsung.
 *
 * @param projectId ID project yang akan di-export
 * @param platforms Platform targets
 * @returns Hasil export (videoUrl, thumbnailUrl, cost, duration)
 */
export type ExportProjectCallback = (
    projectId: string,
    platforms: PlatformTarget[],
) => Promise<ExportProjectResult>;

/**
 * Hasil export satu project.
 */
export interface ExportProjectResult {
    /** URL video hasil export */
    videoUrl: string;

    /** URL thumbnail */
    thumbnailUrl?: string;

    /** Cost export dalam USD */
    cost: number;

    /** Durasi video dalam detik */
    duration: number;
}

/**
 * Hasil batch orchestrator.
 */
export interface BatchOrchestratorResult {
    /** Semua items dengan status final */
    items: BatchItem[];

    /** Total items dalam batch */
    total: number;

    /** Jumlah item yang berhasil (DONE) */
    succeeded: number;

    /** Jumlah item yang gagal (FAILED) */
    failed: number;

    /** Jumlah item yang di-skip (SKIPPED) */
    skipped: number;

    /** Jumlah item yang di-cancel (CANCELLED) */
    cancelled: number;

    /** Total cost batch dalam USD */
    totalCost: number;

    /** Total durasi semua video dalam detik */
    totalDuration: number;

    /** Apakah batch di-cancel mid-process */
    wasCancelled: boolean;

    /** Warning selama batch process */
    warnings: string[];

    /** Ringkasan satu kalimat */
    summary: string;
}

// ============================================================
// Error
// ============================================================

/**
 * Error yang dilempar saat batch orchestrator gagal.
 */
export class BatchOrchestratorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BatchOrchestratorError';
    }
}

// ============================================================
// Main Orchestrator
// ============================================================

/**
 * Jalankan batch export untuk multiple projects.
 *
 * Alur:
 * 1. Validasi input (items tidak kosong)
 * 2. Inisialisasi BatchItem[] dari input (skip yang belum REVIEWED)
 * 3. Export setiap project via callback:
 *    - Sequential: satu per satu
 *    - Parallel: dengan maxConcurrency
 * 4. Track progress per item
 * 5. Return batch result dengan status final
 *
 * @param input Items + mode + concurrency
 * @param exportCallback Fungsi yang di-inject caller untuk export satu project
 * @param cancelToken Token untuk cancel batch mid-process (opsional)
 * @returns Hasil batch dengan status per item
 */
export async function orchestrateBatchExport(
    input: BatchOrchestratorInput,
    exportCallback: ExportProjectCallback,
    cancelToken?: { cancelled: boolean },
): Promise<BatchOrchestratorResult> {
    // --- Validate input ---
    if (!input.items || input.items.length === 0) {
        throw new BatchOrchestratorError(
            'Cannot orchestrate batch: items list is empty.',
        );
    }

    const skipNotReviewed = input.skipNotReviewed ?? true;
    const warnings: string[] = [];

    // --- Initialize items ---
    const items: BatchItem[] = input.items.map((item) => {
        if (skipNotReviewed && !item.isReviewed) {
            warnings.push(`Project "${item.title}" (${item.projectId}) skipped — not yet REVIEWED.`);
            return {
                projectId: item.projectId,
                title: item.title,
                platforms: item.platforms,
                status: 'SKIPPED' as const,
            };
        }
        return {
            projectId: item.projectId,
            title: item.title,
            platforms: item.platforms,
            status: 'PENDING' as const,
        };
    });

    // --- Filter items that need export ---
    const itemsToExport = items.filter((item) => item.status === 'PENDING');

    if (itemsToExport.length === 0) {
        warnings.push('No items to export — all projects were skipped.');
        return buildBatchResult(items, warnings, false);
    }

    // --- Export items ---
    const mode = input.mode ?? 'sequential';
    const maxConcurrency = input.maxConcurrency ?? 3;

    if (mode === 'sequential') {
        await exportSequential(itemsToExport, exportCallback, cancelToken);
    } else {
        await exportParallel(itemsToExport, exportCallback, maxConcurrency, cancelToken);
    }

    // --- Check if cancelled ---
    const wasCancelled = cancelToken?.cancelled ?? false;
    if (wasCancelled) {
        // Mark remaining PENDING items as CANCELLED
        for (const item of items) {
            if (item.status === 'PENDING' || item.status === 'EXPORTING') {
                item.status = 'CANCELLED';
            }
        }
        warnings.push('Batch was cancelled mid-process.');
    }

    return buildBatchResult(items, warnings, wasCancelled);
}

// ============================================================
// Sequential Export
// ============================================================

/**
 * Export items satu per satu (sequential).
 */
async function exportSequential(
    items: BatchItem[],
    exportCallback: ExportProjectCallback,
    cancelToken?: { cancelled: boolean },
): Promise<void> {
    for (const item of items) {
        if (cancelToken?.cancelled) {
            break;
        }

        await exportSingleItem(item, exportCallback);
    }
}

// ============================================================
// Parallel Export
// ============================================================

/**
 * Export items dengan concurrency limit (parallel).
 */
async function exportParallel(
    items: BatchItem[],
    exportCallback: ExportProjectCallback,
    maxConcurrency: number,
    cancelToken?: { cancelled: boolean },
): Promise<void> {
    const queue = [...items];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(maxConcurrency, queue.length); i++) {
        workers.push(runWorker(queue, exportCallback, cancelToken));
    }

    await Promise.all(workers);
}

/**
 * Worker yang memproses item dari queue sampai habis atau di-cancel.
 */
async function runWorker(
    queue: BatchItem[],
    exportCallback: ExportProjectCallback,
    cancelToken?: { cancelled: boolean },
): Promise<void> {
    while (queue.length > 0) {
        if (cancelToken?.cancelled) {
            break;
        }

        const item = queue.shift();
        if (!item) break;

        await exportSingleItem(item, exportCallback);
    }
}

// ============================================================
// Single Item Export
// ============================================================

/**
 * Export satu item via callback.
 */
async function exportSingleItem(
    item: BatchItem,
    exportCallback: ExportProjectCallback,
): Promise<void> {
    item.status = 'EXPORTING';
    item.startedAt = new Date().toISOString();

    try {
        const result = await exportCallback(item.projectId, item.platforms);

        item.status = 'DONE';
        item.videoUrl = result.videoUrl;
        item.thumbnailUrl = result.thumbnailUrl;
        item.cost = result.cost;
        item.duration = result.duration;
        item.completedAt = new Date().toISOString();
    } catch (error) {
        item.status = 'FAILED';
        item.error = error instanceof Error ? error.message : String(error);
        item.completedAt = new Date().toISOString();
    }
}

// ============================================================
// Build Result
// ============================================================

/**
 * Build hasil akhir batch dari items.
 */
function buildBatchResult(
    items: BatchItem[],
    warnings: string[],
    wasCancelled: boolean,
): BatchOrchestratorResult {
    const total = items.length;
    const succeeded = items.filter((i) => i.status === 'DONE').length;
    const failed = items.filter((i) => i.status === 'FAILED').length;
    const skipped = items.filter((i) => i.status === 'SKIPPED').length;
    const cancelled = items.filter((i) => i.status === 'CANCELLED').length;

    const totalCost = items
        .filter((i) => i.cost !== undefined)
        .reduce((sum, i) => sum + (i.cost ?? 0), 0);

    const totalDuration = items
        .filter((i) => i.duration !== undefined)
        .reduce((sum, i) => sum + (i.duration ?? 0), 0);

    let summary: string;
    if (wasCancelled) {
        summary = `Batch cancelled: ${succeeded} succeeded, ${cancelled} cancelled, ${failed} failed.`;
    } else if (failed > 0) {
        summary = `Batch completed with errors: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped.`;
    } else if (skipped > 0) {
        summary = `Batch completed: ${succeeded} succeeded, ${skipped} skipped.`;
    } else {
        summary = `Batch completed: all ${succeeded} projects exported successfully.`;
    }

    return {
        items,
        total,
        succeeded,
        failed,
        skipped,
        cancelled,
        totalCost,
        totalDuration,
        wasCancelled,
        warnings,
        summary,
    };
}

// ============================================================
// Helper — Retry Failed Items
// ============================================================

/**
 * Retry export untuk item yang FAILED dalam batch sebelumnya.
 *
 * @param result Hasil batch sebelumnya
 * @param exportCallback Fungsi export yang sama
 * @param cancelToken Token cancel (opsional)
 * @returns Hasil batch baru untuk retry items
 */
export async function retryFailedBatchItems(
    result: BatchOrchestratorResult,
    exportCallback: ExportProjectCallback,
    cancelToken?: { cancelled: boolean },
): Promise<BatchOrchestratorResult> {
    const failedItems = result.items.filter((i) => i.status === 'FAILED');

    if (failedItems.length === 0) {
        return {
            ...result,
            warnings: [...result.warnings, 'No failed items to retry.'],
        };
    }

    const retryInput: BatchOrchestratorInput = {
        items: failedItems.map((item) => ({
            projectId: item.projectId,
            title: item.title,
            platforms: item.platforms,
            isReviewed: true, // sudah lolos review sebelumnya
        })),
        mode: 'sequential', // retry aman dengan sequential
        skipNotReviewed: false, // sudah di-review di batch awal
    };

    return orchestrateBatchExport(retryInput, exportCallback, cancelToken);
}

// ============================================================
// Helper — Create Cancel Token
// ============================================================

/**
 * Buat cancel token untuk batch orchestrator.
 * Set `token.cancelled = true` untuk cancel batch mid-process.
 */
export function createCancelToken(): { cancelled: boolean } {
    return { cancelled: false };
}