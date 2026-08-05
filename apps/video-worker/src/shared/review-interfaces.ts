/**
 * Suro-Buya Video Worker — Review Workflow Interfaces (VF-5.4)
 *
 * Kontrak tipe yang dipakai bersama oleh review workflow dan activities.
 * Terpisah dari media-job interfaces supaya modular.
 *
 * Lihat IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-5.4:
 * "Temporal workflow: human-in-the-loop approval"
 */

import type { ContentRating } from '@suro-buya/shared';
import type { CanonValidationResult } from '@suro-buya/engine-v2';
import type { SafetyReviewResult } from '@suro-buya/engine-v2';

/**
 * Input untuk Review workflow.
 *
 * Dikirim oleh client (apps/web API route di VF-5.5) saat memulai workflow review.
 * Berisi semua data yang dibutuhkan untuk canonical + safety review.
 */
export interface ReviewWorkflowInput {
    /** ID VideoProject yang di-review */
    projectId: string;

    /** ID Universe pemilik project */
    universeId: string;

    /** ID reviewer yang memulai workflow (opsional, untuk audit) */
    reviewerId?: string;

    /** Script final video */
    script: string;

    /** Shot descriptions dari storyboard (ShotSpec.description) */
    shotDescriptions?: string[];

    /** Visual prompts per shot */
    visualPrompts?: string[];

    /** ID karakter utama */
    characterId: string;

    /** Rating universe */
    contentRating: ContentRating;

    /** Profil audiens bebas teks dari universe */
    audienceProfile?: string;

    /** ID VideoSeries (kalau bagian dari series) */
    seriesId?: string;

    /** Urutan episode dalam series */
    episodeOrder?: number;

    /** Judul video */
    title?: string;
}

/**
 * Hasil canon check final (VF-5.2).
 * Wrapper sekitar CanonValidationResult dari engine-v2.
 */
export interface CanonCheckResult {
    /** Apakah canon check lolos (tidak ada error) */
    valid: boolean;

    /** Consistency score 0-1 */
    consistencyScore: number;

    /** Violations detail */
    violations: Array<{
        rule: string;
        severity: 'error' | 'warning' | 'info';
        location?: string;
        expected: unknown;
        actual: unknown;
        suggestion?: string;
    }>;

    /** Errors yang block export */
    errors: Array<{ path: string; message: string; code: string }>;

    /** Warnings */
    warnings: Array<{ path: string; message: string; code: string }>;

    /** Infos */
    infos: Array<{ path: string; message: string; code: string }>;
}

/**
 * Hasil safety review (VF-5.1).
 * Wrapper sekitar SafetyReviewResult dari engine-v2.
 */
export interface SafetyCheckResult {
    /** Apakah lolos untuk export otomatis (tidak ada baseline violation) */
    passed: boolean;

    /** Findings dari baseline policy (severity 'block') */
    baselinePolicyFindings: Array<{
        layer: 'baseline-policy';
        severity: 'block';
        category: string;
        ruleId: string;
        message: string;
        location?: string;
        suggestion?: string;
        confidence: number;
    }>;

    /** Findings dari rating-consistency (severity 'warning'/'info') */
    ratingConsistencyFindings: Array<{
        layer: 'rating-consistency';
        severity: 'warning' | 'info';
        category: string;
        ruleId: string;
        message: string;
        location?: string;
        suggestion?: string;
        confidence: number;
    }>;

    /** Semua findings gabungan */
    allFindings: Array<{
        layer: 'baseline-policy' | 'rating-consistency';
        severity: 'block' | 'warning' | 'info';
        category: string;
        ruleId: string;
        message: string;
        location?: string;
        suggestion?: string;
        confidence: number;
    }>;

    /** Apakah ada baseline policy violation */
    hasBaselineViolation: boolean;

    /** Apakah ada rating-consistency warning */
    hasRatingWarning: boolean;

    /** Severity keseluruhan */
    overallSeverity: 'ok' | 'warning' | 'blocked';

    /** Ringkasan satu kalimat */
    summary: string;

    /** Rating yang dipakai */
    contentRating: ContentRating;

    /** Apakah LLM classifier dipakai */
    llmClassifierUsed: boolean;
}

/**
 * Hasil akhir Review workflow.
 */
export interface ReviewWorkflowResult {
    /** ID project */
    projectId: string;

    /** Hasil canon check */
    canonResult: CanonCheckResult;

    /** Hasil safety review */
    safetyResult: SafetyCheckResult;

    /** Status keseluruhan */
    overallStatus: 'PASSED' | 'WARNING' | 'BLOCKED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

    /** Apakah butuh human approval */
    requiresHumanApproval: boolean;

    /** Jenis approval yang dibutuhkan */
    approvalType: 'MANDATORY' | 'OPTIONAL' | 'NONE';

    /** Keputusan human (null kalau belum di-review atau auto-passed) */
    humanDecision: 'APPROVE' | 'REJECT' | null;

    /** Feedback human reviewer */
    humanFeedback: string | null;
}

/**
 * Input untuk activity createSafetyReviewLogs.
 */
export interface CreateSafetyReviewLogsInput {
    projectId: string;
    universeId: string;
    contentRating: ContentRating;
    canonFindings: CanonCheckResult['violations'];
    safetyFindings: SafetyCheckResult['allFindings'];
    overallStatus: ReviewWorkflowResult['overallStatus'];
    requiresHumanApproval: boolean;
    approvalType: ReviewWorkflowResult['approvalType'];
}

/**
 * Input untuk activity updateSafetyReviewLogs.
 */
export interface UpdateSafetyReviewLogsInput {
    projectId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_PASSED' | 'AUTO_BLOCKED';
    reviewerId: string | null;
    feedback?: string;
}

/**
 * Activity interface untuk Review workflow.
 */
export interface ReviewActivities {
    /**
     * Jalankan canon check final (VF-5.2).
     * Memanggil CanonValidator.validateVideoFinal() dari engine-v2.
     */
    runCanonCheckFinal(input: {
        projectId: string;
        universeId: string;
        script: string;
        shotDescriptions?: string[];
        visualPrompts?: string[];
        characterId: string;
        contentRating: ContentRating;
        audienceProfile?: string;
        seriesId?: string;
        episodeOrder?: number;
    }): Promise<CanonCheckResult>;

    /**
     * Jalankan safety review (VF-5.1).
     * Memanggil reviewSafety() dari engine-v2/validate/safety-review.ts.
     */
    runSafetyReview(input: {
        projectId: string;
        universeId: string;
        content: string;
        contentRating: ContentRating;
        audienceProfile?: string;
        videoMetadata?: {
            title?: string;
            shotDescriptions?: string[];
            dialogueText?: string;
        };
    }): Promise<SafetyCheckResult>;

    /**
     * Buat SafetyReviewLog entries awal (VF-5.3).
     * Simpan canon findings + safety findings sebagai audit trail.
     */
    createSafetyReviewLogs(input: CreateSafetyReviewLogsInput): Promise<void>;

    /**
     * Update SafetyReviewLog setelah human approval/rejection.
     */
    updateSafetyReviewLogs(input: UpdateSafetyReviewLogsInput): Promise<void>;
}