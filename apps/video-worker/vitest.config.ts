/**
 * Suro-Buya Video Worker — Vitest Configuration (VF-3.5)
 *
 * Config vitest untuk test suite video-worker.
 *
 * Catatan khusus Temporal:
 * - @temporalio/testing (TestWorkflowEnvironment) dijalankan sebagai
 *   node environment — tidak membutuhkan browser/jsdom
 * - Workflow file di-bundle dengan workflowsPath (path ke JS file, bukan TS)
 *   → untuk test, Temporal SDK meng-handle transpilasi workflow
 * - Timeout lebih panjang dari engine-v2 karena TestWorkflowEnvironment
 *   startup membutuhkan waktu (~10-30 detik)
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Node environment — Temporal tidak bisa di browser
        environment: 'node',

        // Test files — unit tests dijalankan oleh `pnpm test` (default).
        // Temporal workflow integration test (vf35-temporal-workflow.test.ts,
        // vf46-render-workflow.test.ts) di-exclude dari default run karena:
        // 1. Membutuhkan @temporalio/testing yang menarik @grpc/grpc-js — package
        //    yang menyertakan raw TypeScript (src/*.ts) di samping compiled JS
        //    (build/src/*.js). Resolver Vite salah pilih .ts file → SyntaxError.
        // 2. TestWorkflowEnvironment startup membutuhkan waktu ~10-30 detik.
        //
        // Temporal workflow test dijalankan terpisah via `pnpm test:temporal`
        // dan `pnpm test:render-temporal`.
        include: ['tests/**/*.test.ts'],
        exclude: [
            'tests/vf35-temporal-workflow.test.ts',
            'tests/vf46-render-workflow.test.ts',
            '**/node_modules/**',
            '**/dist/**',
        ],

        // Timeout lebih panjang untuk Temporal integration tests
        // TestWorkflowEnvironment.createLocal() butuh ~10-30 detik startup
        testTimeout: 60_000,   // 60 detik per test
        hookTimeout: 90_000,   // 90 detik untuk beforeAll (TestWorkflowEnvironment startup)

        // Vitest reporter
        reporters: ['verbose'],

        // Coverage (opsional — diaktifkan via --coverage flag)
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts'], // entry point tidak perlu coverage
        },

        // Module isolation — penting untuk mock vi.mock() di unit tests
        // clearMocks: reset setelah setiap test
        clearMocks: true,
        mockReset: false, // false agar vi.resetModules() di test bisa dipanggil manual

        // Pool — forks agar setiap test file punya isolated module scope
        // Penting untuk vi.resetModules() dan dynamic import di unit tests
        pool: 'forks',
    },

    // Resolve TypeScript paths (mirror tsconfig.json paths)
    resolve: {
        alias: {
            '@suro-buya/shared': new URL('../../packages/shared/src', import.meta.url).pathname,
            '@suro-buya/engine-v2': new URL('../../packages/engine-v2/src', import.meta.url).pathname,
        },
    },
});