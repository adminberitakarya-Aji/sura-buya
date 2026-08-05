/**
 * VF-5.5 — Review API client extensions
 *
 * This file provides review & approval API methods for the studio review page.
 * Mengikuti pola yang sama dengan export-api.ts (VF-4.7) dan generate-api.ts (VF-3.7).
 *
 * API methods:
 * - startReview: POST /review — trigger review workflow (canon + safety)
 * - getReviewStatus: GET /review — get review status + result
 * - approveReview: POST /review/approve — send approval signal
 * - rejectReview: POST /review/reject — send rejection signal
 * - getReviewLogs: GET /review/logs — get SafetyReviewLog audit trail
 */

// ============================================================
// Types — mirror dari ReviewWorkflowResult (video-worker/shared/review-interfaces)
// ============================================================

export type ContentRating = 'ALL_AGES' | 'TEEN' | 'MATURE';

export type ReviewOverallStatus =
  | 'PASSED'
  | 'WARNING'
  | 'BLOCKED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApprovalType = 'MANDATORY' | 'OPTIONAL' | 'NONE';

export type HumanDecision = 'APPROVE' | 'REJECT' | null;

export type WorkflowStatus =
  | 'RUNNING_CANON_CHECK'
  | 'RUNNING_SAFETY_REVIEW'
  | 'WAITING_APPROVAL'
  | 'WAITING_APPROVAL_OPTIONAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_PASSED'
  | 'CANCELLED';

export interface CanonViolation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  location?: string;
  expected: unknown;
  actual: unknown;
  suggestion?: string;
}

export interface CanonCheckResult {
  valid: boolean;
  consistencyScore: number;
  violations: CanonViolation[];
  errors: Array<{ path: string; message: string; code: string }>;
  warnings: Array<{ path: string; message: string; code: string }>;
  infos: Array<{ path: string; message: string; code: string }>;
}

export interface SafetyFinding {
  layer: 'baseline-policy' | 'rating-consistency';
  severity: 'block' | 'warning' | 'info';
  category: string;
  ruleId: string;
  message: string;
  location?: string;
  suggestion?: string;
  confidence: number;
}

export interface SafetyCheckResult {
  passed: boolean;
  baselinePolicyFindings: SafetyFinding[];
  ratingConsistencyFindings: SafetyFinding[];
  allFindings: SafetyFinding[];
  hasBaselineViolation: boolean;
  hasRatingWarning: boolean;
  overallSeverity: 'ok' | 'warning' | 'blocked';
  summary: string;
  contentRating: ContentRating;
  llmClassifierUsed: boolean;
}

export interface ReviewWorkflowResult {
  projectId: string;
  canonResult: CanonCheckResult;
  safetyResult: SafetyCheckResult;
  overallStatus: ReviewOverallStatus;
  requiresHumanApproval: boolean;
  approvalType: ApprovalType;
  humanDecision: HumanDecision;
  humanFeedback: string | null;
}

// ============================================================
// SafetyReviewLog — mirror dari Prisma model (VF-5.3)
// ============================================================

export type ReviewLogStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_PASSED'
  | 'AUTO_BLOCKED';

export type SafetyLayer = 'BASELINE_POLICY' | 'RATING_CONSISTENCY';

export type SafetyCategory =
  | 'ILLEGAL_CONTENT'
  | 'HATE_SPEECH'
  | 'NON_CONSENSUAL_SEXUAL_CONTENT'
  | 'VIOLENCE_PROMOTION'
  | 'RATING_MISMATCH'
  | 'TONE_MISMATCH'
  | 'INTENSITY_MISMATCH'
  | 'THEME_MISMATCH';

export type SafetySeverity = 'BLOCK' | 'WARNING' | 'INFO';

export interface SafetyReviewLogEntry {
  id: string;
  projectId: string;
  universeId: string;
  reviewerId: string | null;
  status: ReviewLogStatus;
  layer: SafetyLayer;
  flaggedRule: string | null;
  category: SafetyCategory;
  severity: SafetySeverity;
  message: string;
  location: string | null;
  suggestion: string | null;
  confidence: number;
  contentRating: ContentRating;
  videoMetadata: Record<string, unknown> | null;
  feedback: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer?: { id: string; name: string | null; email: string } | null;
}

// ============================================================
// API Response Types
// ============================================================

export interface StartReviewResult {
  message: string;
  workflowId: string;
  projectId: string;
}

export interface ReviewStatusResult {
  projectStatus: string;
  title: string;
  workflowId: string | null;
  workflowStatus: WorkflowStatus | null;
  reviewResult: ReviewWorkflowResult | null;
  hasReview: boolean;
}

export interface ApproveReviewResult {
  message: string;
  decision: 'APPROVE';
}

export interface RejectReviewResult {
  message: string;
  decision: 'REJECT';
}

export interface ReviewLogsResult {
  logs: SafetyReviewLogEntry[];
}

// ============================================================
// Review API methods
// ============================================================

export const reviewApi = {
  /**
   * Start review workflow — trigger canon check + safety review via Temporal.
   */
  startReview: async (
    universeId: string,
    projectId: string,
  ): Promise<StartReviewResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to start review');
    }
    return body as StartReviewResult;
  },

  /**
   * Get review status — workflow status + review result (canon + safety findings).
   */
  getReviewStatus: async (
    universeId: string,
    projectId: string,
  ): Promise<ReviewStatusResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/review`,
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to get review status');
    }
    return body as ReviewStatusResult;
  },

  /**
   * Approve review — send approval signal to workflow.
   */
  approveReview: async (
    universeId: string,
    projectId: string,
    feedback?: string,
  ): Promise<ApproveReviewResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/review/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to approve review');
    }
    return body as ApproveReviewResult;
  },

  /**
   * Reject review — send rejection signal to workflow.
   */
  rejectReview: async (
    universeId: string,
    projectId: string,
    feedback?: string,
  ): Promise<RejectReviewResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/review/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to reject review');
    }
    return body as RejectReviewResult;
  },

  /**
   * Get SafetyReviewLog audit trail — semua log entries untuk project ini.
   */
  getReviewLogs: async (
    universeId: string,
    projectId: string,
  ): Promise<ReviewLogsResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/review/logs`,
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to get review logs');
    }
    return body as ReviewLogsResult;
  },
};