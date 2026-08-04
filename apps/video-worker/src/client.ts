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
import { getStatus, cancelSignal } from './workflows/index.js';

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