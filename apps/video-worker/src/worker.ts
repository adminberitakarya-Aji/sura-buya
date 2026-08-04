/**
 * Suro-Buya Video Worker — Temporal Worker Setup (VF-3.5)
 *
 * Membuat dan menjalankan Temporal Worker. Worker ini:
 * - Poll tasks dari task queue "video-media-queue" (configurable via env)
 * - Eksekusi workflows (mediaJobWorkflow) dan activities (generateImage, generateVideoClip, dll.)
 * - Resume-on-crash: kalau worker crash dan restart, Temporal otomatis
 *   re-assign tasks ke worker baru — workflow state tidak hilang
 *
 * Worker ini adalah proses terpisah dari apps/web — berjalan sebagai
 * standalone Node.js process (lihat index.ts entry point).
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { readFileSync } from 'node:fs';
import { activities } from './activities/index.js';
import { loadConfig } from './config.js';
import { prisma } from './lib/db.js';

/**
 * Buat dan jalankan Temporal Worker.
 *
 * Alur:
 * 1. Load config dari env (TEMPORAL_ADDRESS, DATABASE_URL, dll.)
 * 2. Connect ke Temporal server via NativeConnection
 * 3. Buat Worker dengan workflows + activities + task queue
 * 4. Start polling — worker akan process tasks sampai di-stop (SIGINT/SIGTERM)
 *
 * Resume-on-crash: Temporal server menyimpan workflow state. Kalau worker
 * crash di tengah eksekusi activity, Temporal akan re-queue task ke worker
 * lain (atau worker yang sama setelah restart). Activity yang sudah selesai
 * TIDAK di-re-execute — workflow resume dari titik terakhir.
 */
export async function runWorker(): Promise<void> {
    const config = loadConfig();

    console.log('[video-worker] Starting Temporal Worker...');
    console.log(`[video-worker] Temporal address: ${config.temporal.address}`);
    console.log(`[video-worker] Namespace: ${config.temporal.namespace}`);
    console.log(`[video-worker] Task queue: ${config.temporal.taskQueue}`);

    // Build TLS config untuk production (mTLS)
    const tls =
        config.temporal.clientCertPath && config.temporal.clientKeyPath
            ? {
                  clientCertPair: {
                      crt: readFileSync(config.temporal.clientCertPath),
                      key: readFileSync(config.temporal.clientKeyPath),
                  },
              }
            : undefined;

    // Connect ke Temporal server
    const connection = await NativeConnection.connect({
        address: config.temporal.address,
        tls,
    });

    // Buat Worker
    const worker = await Worker.create({
        connection,
        namespace: config.temporal.namespace,
        taskQueue: config.temporal.taskQueue,
        workflowsPath: new URL('./workflows/index.js', import.meta.url)
            .pathname,
        activities,
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('[video-worker] Shutting down gracefully...');
        try {
            await worker.shutdown();
            await prisma.$disconnect();
            console.log('[video-worker] Shutdown complete.');
            process.exit(0);
        } catch (err) {
            console.error('[video-worker] Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start worker — ini akan block sampai worker di-stop
    console.log('[video-worker] Worker started. Polling for tasks...');
    await worker.run();
}