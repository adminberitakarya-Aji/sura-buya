/**
 * Suro-Buya Video Worker — Review & Approval Workflow (VF-5.4)
 *
 * Temporal workflow untuk human-in-the-loop approval sebelum export video.
 *
 * Alur:
 * 1. Jalankan CanonValidator.validateVideoFinal() (VF-5.2) — cek persona & continuity
 * 2. Jalankan reviewSafety() (VF-5.1) — baseline policy + rating-consistency
 * 3. Simpan hasil ke SafetyReviewLog (VF-5.3) dengan status PENDING
 * 4. Kalau baseline policy violation → WAJIB human approval (pause workflow sampai signal approve/reject)
 * 5. Kalau rating-consistency warning → OPSIONAL human approval (bisa auto-pass, tapi tetap simpan log)
 * 6. Kalau lolos keduanya → AUTO_PASSED (langsung lanjut ke export)
 * 7. Human approve → update status APPROVED, lanjut ke export
 * 8. Human reject → update status REJECTED, throw error supaya workflow gagal
 *
 * Acceptance criteria VF-5.4:
 * - Pause menunggu approval reviewer — WAJIB untuk hasil baseline policy fail
 * - Opsional/informational untuk rating-consistency warning
 */
import {
    proxyActivities,
    defineSignal,
    defineQuery,
    setHandler,
    condition,
    sleep,
} from '@temporalio/workflow';
import type { ReviewWorkflowInput, ReviewWorkflowResult, ReviewActivities } from '../shared/review-interfaces.js';
import { DEFAULT_ACTIVITY_OPTIONS } from '../config.js';

/**
 * Activity proxy — memanggil activities via Temporal.
 */
const activities = proxyActivities<ReviewActivities>(DEFAULT_ACTIVITY_OPTIONS);

/**
 * Signal untuk human approval decision.
 */
export const approvalSignal = defineSignal<[decision: 'APPROVE' | 'REJECT', feedback?: string]>('approval');

/**
 * Signal untuk cancel workflow.
 */
export const cancelSignal = defineSignal('cancel');

/**
 * Query untuk cek status workflow dari client.
 */
export const getStatus = defineQuery<string>('getStatus');

/**
 * Query untuk mendapatkan review result (bisa diakses sebelum approval).
 */
export const getReviewResult = defineQuery<ReviewWorkflowResult | null>('getReviewResult');

/**
 * Internal workflow status.
 */
type WorkflowStatus = 
    | 'RUNNING_CANON_CHECK'
    | 'RUNNING_SAFETY_REVIEW'
    | 'WAITING_APPROVAL'
    | 'WAITING_APPROVAL_OPTIONAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'AUTO_PASSED'
    | 'CANCELLED';

/**
 * Workflow utama untuk review & approval video sebelum export.
 *
 * @param input Data lengkap untuk review video
 * @returns ReviewWorkflowResult dengan keputusan akhir
 */
export async function reviewWorkflow(input: ReviewWorkflowInput): Promise<ReviewWorkflowResult> {
    let status: WorkflowStatus = 'RUNNING_CANON_CHECK';
    let reviewResult: ReviewWorkflowResult | null = null;
    let cancelled = false;
    let approvalDecision: 'APPROVE' | 'REJECT' | null = null;
    let approvalFeedback: string | undefined;

    // Register query handlers
    setHandler(getStatus, () => status);
    setHandler(getReviewResult, () => reviewResult);

    // Register signal handlers
    setHandler(approvalSignal, (decision, feedback) => {
        approvalDecision = decision;
        approvalFeedback = feedback;
    });
    setHandler(cancelSignal, () => {
        cancelled = true;
    });

    try {
        // ============================================================
        // Step 1: Canon check final (VF-5.2)
        // ============================================================
        status = 'RUNNING_CANON_CHECK';
        const canonResult = await activities.runCanonCheckFinal({
            projectId: input.projectId,
            universeId: input.universeId,
            script: input.script,
            shotDescriptions: input.shotDescriptions,
            visualPrompts: input.visualPrompts,
            characterId: input.characterId,
            contentRating: input.contentRating,
            audienceProfile: input.audienceProfile,
            seriesId: input.seriesId,
            episodeOrder: input.episodeOrder,
        });

        // ============================================================
        // Step 2: Safety review (VF-5.1)
        // ============================================================
        status = 'RUNNING_SAFETY_REVIEW';
        const safetyResult = await activities.runSafetyReview({
            projectId: input.projectId,
            universeId: input.universeId,
            content: input.script, // gunakan script sebagai konten utama
            contentRating: input.contentRating,
            audienceProfile: input.audienceProfile,
            videoMetadata: {
                title: input.title,
                shotDescriptions: input.shotDescriptions,
                dialogueText: input.shotDescriptions?.join(' '),
            },
        });

        // ============================================================
        // Step 3: Determine approval requirement
        // ============================================================
        const hasBaselineViolation = safetyResult.hasBaselineViolation;
        const hasRatingWarning = safetyResult.hasRatingWarning;
        const canonPassed = canonResult.valid;

        // Determine overall status
        let overallStatus: ReviewWorkflowResult['overallStatus'];
        let requiresHumanApproval = false;
        let approvalType: 'MANDATORY' | 'OPTIONAL' | 'NONE' = 'NONE';

        if (hasBaselineViolation) {
            // Baseline policy violation → WAJIB human approval
            overallStatus = 'BLOCKED';
            requiresHumanApproval = true;
            approvalType = 'MANDATORY';
        } else if (!canonPassed) {
            // Canon check failed → WAJIB human approval
            overallStatus = 'BLOCKED';
            requiresHumanApproval = true;
            approvalType = 'MANDATORY';
        } else if (hasRatingWarning) {
            // Rating-consistency warning → OPSIONAL human approval (informational)
            overallStatus = 'WARNING';
            requiresHumanApproval = true;
            approvalType = 'OPTIONAL';
        } else {
            // Lolos semua → AUTO_PASSED
            overallStatus = 'PASSED';
            requiresHumanApproval = false;
            approvalType = 'NONE';
        }

        // Build review result
        reviewResult = {
            projectId: input.projectId,
            canonResult,
            safetyResult,
            overallStatus,
            requiresHumanApproval,
            approvalType,
            humanDecision: null,
            humanFeedback: null,
        };

        // ============================================================
        // Step 4: Save initial SafetyReviewLog (VF-5.3)
        // ============================================================
        await activities.createSafetyReviewLogs({
            projectId: input.projectId,
            universeId: input.universeId,
            contentRating: input.contentRating,
            canonFindings: canonResult.violations,
            safetyFindings: safetyResult.allFindings,
            overallStatus,
            requiresHumanApproval,
            approvalType,
        });

        // ============================================================
        // Step 5: Handle human approval if required
        // ============================================================
        if (requiresHumanApproval) {
            if (approvalType === 'MANDATORY') {
                status = 'WAITING_APPROVAL';
            } else {
                status = 'WAITING_APPROVAL_OPTIONAL';
            }

            // Wait for approval signal or timeout (7 days = 604800 seconds)
            // Kalau OPTIONAL, set timeout lebih pendek (24 jam = 86400 detik) lalu auto-approve
            const timeoutMs = approvalType === 'MANDATORY' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            
            // Poll untuk approval decision
            await condition(
                () => approvalDecision !== null || cancelled,
                timeoutMs,
            );

            if (cancelled) {
                status = 'CANCELLED';
                reviewResult = {
                    ...reviewResult,
                    overallStatus: 'CANCELLED',
                    humanDecision: 'REJECT',
                    humanFeedback: 'Cancelled by user',
                };
                await activities.updateSafetyReviewLogs({
                    projectId: input.projectId,
                    status: 'REJECTED',
                    reviewerId: 'system',
                    feedback: 'Cancelled by user',
                });
                throw new Error('Review workflow cancelled by user');
            }

            if (approvalDecision === 'APPROVE') {
                status = 'APPROVED';
                const feedback = approvalFeedback ?? null;
                reviewResult = {
                    projectId: input.projectId,
                    canonResult: reviewResult!.canonResult,
                    safetyResult: reviewResult!.safetyResult,
                    overallStatus: 'APPROVED' as const,
                    requiresHumanApproval: reviewResult!.requiresHumanApproval,
                    approvalType: reviewResult!.approvalType,
                    humanDecision: 'APPROVE' as const,
                    humanFeedback: feedback,
                };
                const reviewerId = input.reviewerId ?? null;
                await activities.updateSafetyReviewLogs({
                    projectId: input.projectId,
                    status: 'APPROVED',
                    reviewerId,
                    feedback: feedback ?? undefined,
                });
            } else if (approvalDecision === 'REJECT') {
                status = 'REJECTED';
                const feedback = approvalFeedback ?? null;
                reviewResult = {
                    projectId: input.projectId,
                    canonResult: reviewResult!.canonResult,
                    safetyResult: reviewResult!.safetyResult,
                    overallStatus: 'REJECTED' as const,
                    requiresHumanApproval: reviewResult!.requiresHumanApproval,
                    approvalType: reviewResult!.approvalType,
                    humanDecision: 'REJECT' as const,
                    humanFeedback: feedback,
                };
                const reviewerId = input.reviewerId ?? null;
                await activities.updateSafetyReviewLogs({
                    projectId: input.projectId,
                    status: 'REJECTED',
                    reviewerId,
                    feedback: feedback ?? undefined,
                });
                throw new Error(`Review rejected: ${approvalFeedback || 'No feedback provided'}`);
            }
        } else {
            // Auto-passed — update logs
            status = 'AUTO_PASSED';
            reviewResult = {
                ...reviewResult,
                overallStatus: 'PASSED',
                humanDecision: null,
                humanFeedback: null,
            };
            await activities.updateSafetyReviewLogs({
                projectId: input.projectId,
                status: 'AUTO_PASSED',
                reviewerId: 'system',
                feedback: 'Auto-passed: no baseline violation, canon passed, no rating warning',
            });
        }

        return reviewResult!;
    } catch (err) {
        // Kalau error selain rejection (mis. activity failure), update logs
        if (reviewResult && reviewResult.overallStatus !== 'REJECTED' && reviewResult.overallStatus !== 'CANCELLED') {
            await activities.updateSafetyReviewLogs({
                projectId: input.projectId,
                status: 'REJECTED',
                reviewerId: 'system',
                feedback: `Workflow error: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
        throw err;
    }
}