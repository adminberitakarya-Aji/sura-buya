/**
 * Suro-Buya Video Worker — Entry Point (VF-3.5)
 *
 * Entrypoint utama untuk menjalankan Temporal Worker sebagai standalone
 * Node.js process. Dipanggil via:
 *   - development: pnpm dev (tsx watch src/index.ts)
 *   - production:  pnpm start (node dist/index.js)
 *
 * Worker ini mengorkestrasi seluruh media generation pipeline:
 * - IMAGE generation (keyframes) via Nano Banana 2 → Flux 2 Pro chain (VF-3.1)
 * - VIDEO_CLIP generation (image-to-video) via Kling 3.0 → Seedance 2 → Wan 2.7 chain (VF-3.3)
 * - MediaAsset status tracking per shot di database (VF-3.6)
 * - Resume-on-crash: Temporal durable execution menjamin workflow tidak
 *   mulai dari awal kalau worker crash — resume dari titik terakhir
 *
 * Lihat IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-3.5 untuk detail arsitektur.
 */

import { runWorker } from './worker.js';

// Jalankan worker — ini akan block sampai SIGINT/SIGTERM
runWorker().catch((err: unknown) => {
    console.error('[video-worker] Fatal error — worker failed to start:', err);
    process.exit(1);
});
