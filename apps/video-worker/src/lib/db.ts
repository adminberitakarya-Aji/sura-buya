/**
 * Suro-Buya Video Worker — Prisma Client (VF-3.5)
 *
 * Singleton Prisma client untuk video-worker. Pola sama dengan
 * apps/web/src/lib/prisma.ts — globalThis caching untuk mencegah
 * multiple instances saat hot-reload di development.
 *
 * Video-worker butuh akses ke tabel MediaAsset (VF-3.6) untuk:
 * - Update status MediaAsset selama workflow berjalan (PENDING → GENERATING → DONE/FAILED)
 * - Simpan resultUrl, cost, providerUsed, providerAttempts
 * - Baca VideoProject.storyboard (ShotSpec[]) dan CharacterAsset.referenceImages
 *
 * Berbeda dari engine-v2 (yang tidak pernah akses DB langsung), video-worker
 * adalah aplikasi server yang sah untuk akses DB — sama seperti apps/web.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env['NODE_ENV'] === 'development'
                ? ['error', 'warn']
                : ['error'],
    });

if (process.env['NODE_ENV'] !== 'production') {
    globalForPrisma.prisma = prisma;
}