/**
 * Suro-Buya Video Worker — Temporal Client (VF-3.5)
 *
 * Client untuk start, query, dan signal MediaJob workflows. Dipakai oleh
 * apps/web API routes (VF-3.7) saat user trigger "Generate" di UI.
 *
 * Pola: client adalah singleton — satu instance per worker process.
 * apps/web API route akan import client ini untuk interact dengan workflow.
 *
 * API:
 * - startMediaJob(input): Start workflow untuk generate satu media asset
 * - getMediaJobStatus(workflowId): Query status workflow
 * - cancelMediaJob(workflowId): Send cancel signal ke workflow
 */

import type { Client, WorkflowHandle } from '@temporalio/client';
import { createTemporalClient } from './connection.js';
import { loadConfig } from './config.js';
import type { MediaJobWorkflowInput, MediaGenerationResult } from './shared/interfaces.js';
import type { RenderWorkflowInput, RenderWorkflowResult } from './shared/render-interfaces.js';
import { getStatus, cancelSignal } from './workflows/index.js';
import { getRenderStatus, cancelRenderSignal } from './workflows/index.js';
import { approvalSignal, cancelSignal as cancelReviewSignal, getReviewResult } from './workflows/index.js';
import type { ReviewWorkflowInput, ReviewWorkflowResult } from './shared/review-interfaces.js';

/**
 * Singleton Temporal client — dibuat sekali, dipakai berkali-kali.
 */
let clientInstance: Client | null = null;

/**
 * Get atau buat singleton Temporal client.
 */
async function getClient(): Promise<Client> {
    if (!clientInstance) {
        const config = loadConfig();
        // createTemporalClient() butuh TemporalConfig (address/namespace/...),
        // bukan WorkerConfig penuh — TemporalConfig ada di config.temporal.
        clientInstance = await createTemporalClient(config.temporal);
    }
    return clientInstance;
}

/**
 * Start MediaJob workflow untuk generate satu media asset.
 *
 * @param input Data lengkap untuk generate (projectId, shotIndex, type, shotSpec, dll.)
 * @returns Workflow handle untuk interact dengan workflow yang sedang berjalan
 */
export async function startMediaJob(
    input: MediaJobWorkflowInput,
): Promise<WorkflowHandle> {
    const client = await getClient();
    const config = loadConfig();

    // Generate workflow ID — unik per media asset
    const workflowId = `media-job-${input.mediaAssetId}`;

    return await client.workflow.start('mediaJobWorkflow', {
        workflowId,
        taskQueue: config.temporal.taskQueue,
        args: [input],
    });
}

/**
 * Query status MediaJob workflow.
 *
 * @param workflowId ID workflow (dari startMediaJob return value)
 * @returns Status string ('GENERATING', 'DONE', 'FAILED', 'CANCELLED')
 */
export async function getMediaJobStatus(
    workflowId: string,
): Promise<string> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.query(getStatus);
}

/**
 * Cancel MediaJob workflow.
 *
 * @param workflowId ID workflow yang akan di-cancel
 */
export async function cancelMediaJob(workflowId: string): Promise<void> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(cancelSignal);
}

/**
 * Tunggu MediaJob workflow selesai dan dapatkan hasilnya.
 *
 * @param workflowId ID workflow
 * @returns MediaGenerationResult (url, providerUsed, cost, dll.)
 */
export async function waitForMediaJobResult(
    workflowId: string,
): Promise<MediaGenerationResult | undefined> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.result();
}

/**
 * Start Render workflow untuk full video composition.
 *
 * @param input Data lengkap untuk render (videoRenderId, projectId, platforms, dll.)
 * @returns Workflow handle untuk interact dengan workflow yang sedang berjalan
 */
export async function startRenderWorkflow(
    input: RenderWorkflowInput,
): Promise<WorkflowHandle> {
    const client = await getClient();
    const config = loadConfig();

    // Generate workflow ID — unik per video render
    const workflowId = `render-${input.videoRenderId}`;

    return await client.workflow.start('renderWorkflow', {
        workflowId,
        taskQueue: config.temporal.taskQueue,
        args: [input],
    });
}

/**
 * Query status Render workflow.
 *
 * @param workflowId ID workflow (dari startRenderWorkflow return value)
 * @returns Status object dengan detail progress
 */
export async function getRenderWorkflowStatus(
    workflowId: string,
): Promise<{
    status: string;
    currentPlatform: string | null;
    attemptNumber: number;
    lastError: string | undefined;
}> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.query(getRenderStatus);
}

/**
 * Cancel Render workflow.
 *
 * @param workflowId ID workflow yang akan di-cancel
 */
export async function cancelRenderWorkflow(workflowId: string): Promise<void> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(cancelRenderSignal);
}

/**
 * Tunggu Render workflow selesai dan dapatkan hasilnya.
 *
 * @param workflowId ID workflow
 * @returns RenderWorkflowResult dengan URL per platform
 */
export async function waitForRenderWorkflowResult(
    workflowId: string,
): Promise<RenderWorkflowResult | undefined> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.result();
}

// ============================================================
// VF-5.5 — Review Workflow Client API
// ============================================================

/**
 * Start Review workflow untuk canon check + safety review + human approval.
 *
 * @param input Data lengkap untuk review video (projectId, script, characterId, dll.)
 * @returns Workflow handle untuk interact dengan workflow yang sedang berjalan
 */
export async function startReviewWorkflow(
    input: ReviewWorkflowInput,
): Promise<WorkflowHandle> {
    const client = await getClient();
    const config = loadConfig();

    // Generate workflow ID — unik per project review
    const workflowId = `review-${input.projectId}`;

    return await client.workflow.start('reviewWorkflow', {
        workflowId,
        taskQueue: config.temporal.taskQueue,
        args: [input],
    });
}

/**
 * Query status Review workflow.
 *
 * @param workflowId ID workflow (dari startReviewWorkflow return value)
 * @returns Status string ('RUNNING_CANON_CHECK', 'RUNNING_SAFETY_REVIEW', 'WAITING_APPROVAL', dst.)
 */
export async function getReviewWorkflowStatus(
    workflowId: string,
): Promise<string> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.query(getStatus);
}

/**
 * Query review result (bisa diakses sebelum approval — untuk tampilkan canon + safety findings).
 *
 * @param workflowId ID workflow
 * @returns ReviewWorkflowResult atau null kalau belum tersedia
 */
export async function getReviewWorkflowResult(
    workflowId: string,
): Promise<ReviewWorkflowResult | null> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.query(getReviewResult);
}

/**
 * Send approval signal ke Review workflow.
 *
 * @param workflowId ID workflow
 * @param decision 'APPROVE' atau 'REJECT'
 * @param feedback Feedback opsional dari reviewer
 */
export async function sendReviewApproval(
    workflowId: string,
    decision: 'APPROVE' | 'REJECT',
    feedback?: string,
): Promise<void> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(approvalSignal, decision, feedback);
}

/**
 * Cancel Review workflow.
 *
 * @param workflowId ID workflow yang akan di-cancel
 */
export async function cancelReviewWorkflow(workflowId: string): Promise<void> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(cancelReviewSignal);
}

/**
 * Tunggu Review workflow selesai dan dapatkan hasilnya.
 *
 * @param workflowId ID workflow
 * @returns ReviewWorkflowResult dengan keputusan akhir
 */
export async function waitForReviewWorkflowResult(
    workflowId: string,
): Promise<ReviewWorkflowResult | undefined> {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowId);
    return await handle.result();
}
