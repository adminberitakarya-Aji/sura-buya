/**
 * Suro-Buya Video Worker — Vitest Configuration untuk Temporal Integration Tests
 *
 * Config terpisah untuk Temporal workflow integration tests
 * (vf35-temporal-workflow.test.ts & vf46-render-workflow.test.ts).
 *
 * File ini dipakai oleh script `test:temporal` dan `test:render-temporal`:
 *   vitest run --config vitest.temporal.config.ts
 *
 * Alasan dipisah dari vitest.config.ts default:
 * 1. @temporalio/testing menarik @grpc/grpc-js — package yang menyertakan
 *    raw TypeScript (src/*.ts) di samping compiled JS (build/src/*.js).
 *    Resolver Vite (yang dipakai vitest) salah pilih .ts file → SyntaxError.
 *    Solusi: externalize @grpc/grpc-js (dan package @temporalio/*) via
 *    `test.server.deps.external` supaya Node.js native resolver yang menangani
 *    dan memilih build/src/*.js.
 * 2. TestWorkflowEnvironment startup membutuhkan waktu ~10-30 detik,
 *    tidak cocok dijalankan bersama unit tests cepat.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Node environment — Temporal tidak bisa di browser
        environment: 'node',

        // Hanya jalankan Temporal integration test files
        include: [
            'tests/vf35-temporal-workflow.test.ts',
            'tests/vf46-render-workflow.test.ts',
        ],
        exclude: ['**/node_modules/**', '**/dist/**'],

        // Timeout lebih panjang untuk Temporal integration tests
        // TestWorkflowEnvironment.createLocal() butuh ~10-30 detik startup
        testTimeout: 60_000, // 60 detik per test
        hookTimeout: 90_000, // 90 detik untuk beforeAll (TestWorkflowEnvironment startup)

        // Vitest reporter
        reporters: ['verbose'],

        // Module isolation
        clearMocks: true,
        mockReset: false,

        // Pool — forks agar setiap test file punya isolated module scope
        pool: 'forks',

        // Externalize package yang bermasalah dengan Vite resolver.
        // @grpc/grpc-js menyertakan raw .ts files yang dipilih Vite → SyntaxError.
        // Dengan external, Node.js native require/import yang menangani resolusi
        // dan memilih build/src/*.js (compiled).
        server: {
            deps: {
                external: [
                    /^@grpc\/.*/,
                    /^@temporalio\/.*/,
                ],
            },
        },
    },

    // Resolve TypeScript paths (mirror tsconfig.json paths)
    resolve: {
        alias: {
            '@suro-buya/shared': new URL('../../packages/shared/src', import.meta.url).pathname,
            '@suro-buya/engine-v2': new URL('../../packages/engine-v2/src', import.meta.url).pathname,
        },
    },
});