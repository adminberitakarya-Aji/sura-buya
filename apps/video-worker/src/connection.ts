/**
 * Suro-Buya Video Worker — Temporal Connection (VF-3.5)
 *
 * Helper untuk membuat koneksi ke Temporal server. Dipakai oleh:
 * - worker.ts: Worker butuh connection untuk poll tasks
 * - client.ts: Client butuh connection untuk start workflows
 *
 * Mendukung mTLS untuk production (TEMPORAL_CLIENT_CERT_PATH / TEMPORAL_CLIENT_KEY_PATH).
 * Untuk development lokal, tanpa TLS (default: localhost:7233).
 */

import { Connection, Client } from '@temporalio/client';
import { readFileSync } from 'node:fs';
import type { TemporalConfig } from './config.js';

/**
 * Buat koneksi ke Temporal server.
 *
 * @param config Konfigurasi Temporal (address, namespace, TLS)
 * @returns Connection yang siap dipakai untuk Worker atau Client
 */
export async function createTemporalConnection(
    config: TemporalConfig,
): Promise<Connection> {
    const tls = config.clientCertPath && config.clientKeyPath
        ? {
              clientCertPair: {
                  crt: readFileSync(config.clientCertPath),
                  key: readFileSync(config.clientKeyPath),
              },
          }
        : undefined;

    return await Connection.connect({
        address: config.address,
        tls,
    });
}

/**
 * Buat Temporal Client untuk start/query/Signal workflows.
 *
 * Dipakai oleh apps/web API routes (VF-3.7) untuk:
 * - Start mediaJobWorkflow saat user klik "Generate"
 * - Query status workflow untuk progress monitor
 * - Send cancel signal saat user klik "Cancel"
 *
 * @param config Konfigurasi Temporal
 * @returns Client yang siap dipakai untuk interact dengan workflows
 */
export async function createTemporalClient(
    config: TemporalConfig,
): Promise<Client> {
    const connection = await createTemporalConnection(config);
    return new Client({
        connection,
        namespace: config.namespace,
    });
}