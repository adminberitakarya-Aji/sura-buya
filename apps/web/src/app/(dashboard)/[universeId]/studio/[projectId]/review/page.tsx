/**
 * VF-5.5 — Studio Review Page
 *
 * Moderation + canon report, approve/reject/regenerate.
 * Tampilkan jelas mana yang "wajib diperbaiki" (baseline policy)
 * vs "sekadar informasi" (rating-consistency).
 *
 * Layout:
 * 1. Header — project title + status
 * 2. Start Review button (kalau belum ada review)
 * 3. Review Status — workflow status (RUNNING_CANON_CHECK, WAITING_APPROVAL, dst.)
 * 4. Canon Check Report — violations, errors, warnings, infos
 * 5. Safety Review Report — dua section terpisah:
 *    a. Baseline Policy (HARD-BLOCK) — "Wajib Diperbaiki"
 *    b. Rating-Consistency (WARNING/INFO) — "Sekadar Informasi"
 * 6. Approval Actions — Approve / Reject buttons + feedback
 * 7. Audit Trail — SafetyReviewLog history
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { studioApi } from '@/lib/api-client';
import {
  reviewApi,
  type ReviewWorkflowResult,
  type CanonCheckResult,
  type SafetyCheckResult,
  type SafetyFinding,
  type SafetyReviewLogEntry,
  type WorkflowStatus,
} from '@/lib/review-api';
import {
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader,
  RotateCcw,
  FileText,
  Gavel,
  Info,
  Clock,
  History,
  ArrowLeft,
} from 'lucide-react';

export default function ReviewPage() {
  const params = useParams();
  const universeId = params.universeId as string;
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch project data
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['studio-project', universeId, projectId],
    queryFn: () => studioApi.getProject(universeId, projectId),
  });

  // Fetch review status
  const {
    data: reviewData,
    isLoading: reviewLoading,
    refetch: refetchReview,
  } = useQuery({
    queryKey: ['review-status', universeId, projectId],
    queryFn: () => reviewApi.getReviewStatus(universeId, projectId),
    refetchInterval: false, // We'll poll manually when workflow is running
  });

  // Fetch review logs (audit trail)
  const { data: logsData } = useQuery({
    queryKey: ['review-logs', universeId, projectId],
    queryFn: () => reviewApi.getReviewLogs(universeId, projectId),
  });

  // Start review mutation
  const startReviewMutation = useMutation({
    mutationFn: () => reviewApi.startReview(universeId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-status', universeId, projectId] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (reviewFeedback: string) =>
      reviewApi.approveReview(universeId, projectId, reviewFeedback || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-status', universeId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['review-logs', universeId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['studio-project', universeId, projectId] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (reviewFeedback: string) =>
      reviewApi.rejectReview(universeId, projectId, reviewFeedback || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-status', universeId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['review-logs', universeId, projectId] });
    },
  });

  // Poll for status updates when workflow is running
  useEffect(() => {
    const workflowStatus = reviewData?.workflowStatus;
    const isRunning =
      workflowStatus === 'RUNNING_CANON_CHECK' ||
      workflowStatus === 'RUNNING_SAFETY_REVIEW' ||
      workflowStatus === 'WAITING_APPROVAL' ||
      workflowStatus === 'WAITING_APPROVAL_OPTIONAL';

    if (isRunning) {
      pollRef.current = setInterval(() => {
        refetchReview();
      }, 2000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [reviewData?.workflowStatus, refetchReview]);

  if (projectLoading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat project...</div>;
  }

  const project = projectData?.project;

  if (!project) {
    return <div className="text-center py-12 text-muted-foreground">Project tidak ditemukan.</div>;
  }

  const hasScript = project.script && project.script.trim().length > 0;
  const reviewResult = reviewData?.reviewResult ?? null;
  const workflowStatus = reviewData?.workflowStatus ?? null;
  const hasReview = reviewData?.hasReview ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            href={`/${universeId}/studio/${projectId}`}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Project
          </Link>
        </div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Canon & Safety Review</p>
      </div>

      {/* Prerequisite Check */}
      {!hasScript && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Generate script terlebih dahulu sebelum menjalankan review.
        </div>
      )}

      {/* Start Review Section */}
      {hasScript && !hasReview && (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Mulai Review</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Jalankan canon check (konsistensi persona & continuity) dan safety review
            (baseline platform policy + rating-consistency) sebelum export video.
          </p>
          <button
            onClick={() => startReviewMutation.mutate()}
            disabled={startReviewMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {startReviewMutation.isPending ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Start Review
              </>
            )}
          </button>
          {startReviewMutation.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Error: {(startReviewMutation.error as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Review Loading */}
      {reviewLoading && hasReview && (
        <div className="text-center py-8 text-muted-foreground">Memuat review status...</div>
      )}

      {/* Workflow Status */}
      {workflowStatus && (
        <WorkflowStatusCard status={workflowStatus} />
      )}

      {/* Review Results */}
      {reviewResult && (
        <ReviewResults result={reviewResult} />
      )}

      {/* Approval Actions */}
      {reviewResult && reviewResult.requiresHumanApproval && (
        <ApprovalActions
          approvalType={reviewResult.approvalType}
          feedback={feedback}
          setFeedback={setFeedback}
          onApprove={() => approveMutation.mutate(feedback)}
          onReject={() => rejectMutation.mutate(feedback)}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
          approveError={approveMutation.error as Error | null}
          rejectError={rejectMutation.error as Error | null}
          approveSuccess={approveMutation.isSuccess}
        />
      )}

      {/* Regenerate Section */}
      {reviewResult && (reviewResult.overallStatus === 'REJECTED' || reviewResult.canonResult.errors.length > 0) && (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold">Regenerate</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Kalau ada masalah yang perlu diperbaiki, kamu bisa regenerate script atau
            storyboard dari halaman project.
          </p>
          <Link
            href={`/${universeId}/studio/${projectId}`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project to Regenerate
          </Link>
        </div>
      )}

      {/* Audit Trail */}
      {logsData && logsData.logs.length > 0 && (
        <AuditTrail logs={logsData.logs} />
      )}
    </div>
  );
}

// ============================================================
// Workflow Status Card
// ============================================================

function WorkflowStatusCard({ status }: { status: WorkflowStatus }) {
  const config = getWorkflowStatusConfig(status);

  return (
    <div className={`rounded-lg border p-4 ${config.bgClass}`}>
      <div className="flex items-center gap-3">
        <config.icon className={`h-5 w-5 ${config.iconClass}`} />
        <div>
          <h3 className="font-semibold text-sm">{config.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
        </div>
      </div>
    </div>
  );
}

function getWorkflowStatusConfig(status: WorkflowStatus) {
  switch (status) {
    case 'RUNNING_CANON_CHECK':
      return {
        label: 'Running Canon Check',
        description: 'Memeriksa konsistensi persona & continuity...',
        icon: Loader,
        iconClass: 'text-blue-600 animate-spin',
        bgClass: 'bg-blue-50 border-blue-200',
      };
    case 'RUNNING_SAFETY_REVIEW':
      return {
        label: 'Running Safety Review',
        description: 'Memeriksa baseline policy & rating-consistency...',
        icon: Loader,
        iconClass: 'text-blue-600 animate-spin',
        bgClass: 'bg-blue-50 border-blue-200',
      };
    case 'WAITING_APPROVAL':
      return {
        label: 'Waiting for Approval (Mandatory)',
        description: 'Baseline policy violation terdeteksi — wajib approval reviewer.',
        icon: ShieldAlert,
        iconClass: 'text-red-600',
        bgClass: 'bg-red-50 border-red-200',
      };
    case 'WAITING_APPROVAL_OPTIONAL':
      return {
        label: 'Waiting for Approval (Optional)',
        description: 'Rating-consistency warning — approval opsional, creator tetap bisa export.',
        icon: Info,
        iconClass: 'text-yellow-600',
        bgClass: 'bg-yellow-50 border-yellow-200',
      };
    case 'APPROVED':
      return {
        label: 'Approved',
        description: 'Review disetujui — video siap untuk export.',
        icon: CheckCircle,
        iconClass: 'text-green-600',
        bgClass: 'bg-green-50 border-green-200',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        description: 'Review ditolak — perbaiki masalah lalu resubmit.',
        icon: XCircle,
        iconClass: 'text-red-600',
        bgClass: 'bg-red-50 border-red-200',
      };
    case 'AUTO_PASSED':
      return {
        label: 'Auto-Passed',
        description: 'Lolos otomatis — tidak ada baseline violation, canon passed, no rating warning.',
        icon: CheckCircle,
        iconClass: 'text-green-600',
        bgClass: 'bg-green-50 border-green-200',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        description: 'Review dibatalkan.',
        icon: XCircle,
        iconClass: 'text-gray-600',
        bgClass: 'bg-gray-50 border-gray-200',
      };
    default:
      return {
        label: status,
        description: '',
        icon: AlertCircle,
        iconClass: 'text-gray-600',
        bgClass: 'bg-gray-50 border-gray-200',
      };
  }
}

// ============================================================
// Review Results — Canon + Safety
// ============================================================

function ReviewResults({ result }: { result: ReviewWorkflowResult }) {
  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <OverallStatusBanner result={result} />

      {/* Canon Check Report */}
      <CanonCheckReport canonResult={result.canonResult} />

      {/* Safety Review Report */}
      <SafetyReviewReport safetyResult={result.safetyResult} />
    </div>
  );
}

function OverallStatusBanner({ result }: { result: ReviewWorkflowResult }) {
  const config = getOverallStatusConfig(result.overallStatus);

  return (
    <div className={`rounded-lg border p-4 ${config.bgClass}`}>
      <div className="flex items-center gap-3">
        <config.icon className={`h-6 w-6 ${config.iconClass}`} />
        <div className="flex-1">
          <h3 className="font-semibold">{config.label}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {result.safetyResult.summary}
          </p>
        </div>
        {result.safetyResult.contentRating && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium border">
            Rating: {result.safetyResult.contentRating}
          </span>
        )}
      </div>
    </div>
  );
}

function getOverallStatusConfig(status: ReviewWorkflowResult['overallStatus']) {
  switch (status) {
    case 'PASSED':
      return {
        label: 'Review Passed',
        icon: CheckCircle,
        iconClass: 'text-green-600',
        bgClass: 'bg-green-50 border-green-200',
      };
    case 'WARNING':
      return {
        label: 'Review Passed with Warnings',
        icon: Info,
        iconClass: 'text-yellow-600',
        bgClass: 'bg-yellow-50 border-yellow-200',
      };
    case 'BLOCKED':
      return {
        label: 'Review Blocked — Mandatory Fixes Required',
        icon: ShieldAlert,
        iconClass: 'text-red-600',
        bgClass: 'bg-red-50 border-red-200',
      };
    case 'APPROVED':
      return {
        label: 'Approved by Reviewer',
        icon: CheckCircle,
        iconClass: 'text-green-600',
        bgClass: 'bg-green-50 border-green-200',
      };
    case 'REJECTED':
      return {
        label: 'Rejected by Reviewer',
        icon: XCircle,
        iconClass: 'text-red-600',
        bgClass: 'bg-red-50 border-red-200',
      };
    case 'CANCELLED':
      return {
        label: 'Review Cancelled',
        icon: XCircle,
        iconClass: 'text-gray-600',
        bgClass: 'bg-gray-50 border-gray-200',
      };
    default:
      return {
        label: status,
        icon: AlertCircle,
        iconClass: 'text-gray-600',
        bgClass: 'bg-gray-50 border-gray-200',
      };
  }
}

// ============================================================
// Canon Check Report
// ============================================================

function CanonCheckReport({ canonResult }: { canonResult: CanonCheckResult }) {
  const hasIssues =
    canonResult.violations.length > 0 ||
    canonResult.errors.length > 0 ||
    canonResult.warnings.length > 0;

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Canon Check Report</h3>
        </div>
        <div className="flex items-center gap-2">
          {canonResult.valid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3" />
              Valid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <XCircle className="h-3 w-3" />
              Invalid
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Score: {(canonResult.consistencyScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Cek konsistensi persona karakter & continuity series (jika bagian dari VideoSeries).
      </p>

      {!hasIssues && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Tidak ada canon violation — video konsisten dengan persona & continuity.
        </div>
      )}

      {/* Violations */}
      {canonResult.violations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Violations ({canonResult.violations.length})</h4>
          {canonResult.violations.map((violation, i) => (
            <CanonViolationCard key={i} violation={violation} />
          ))}
        </div>
      )}

      {/* Errors */}
      {canonResult.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-700">Errors ({canonResult.errors.length})</h4>
          {canonResult.errors.map((error, i) => (
            <div key={i} className="rounded-md bg-red-50 p-3 text-sm">
              <span className="font-mono text-xs text-red-600">{error.code}</span>
              <p className="mt-1 text-red-800">{error.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {canonResult.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-yellow-700">Warnings ({canonResult.warnings.length})</h4>
          {canonResult.warnings.map((warning, i) => (
            <div key={i} className="rounded-md bg-yellow-50 p-3 text-sm">
              <span className="font-mono text-xs text-yellow-600">{warning.code}</span>
              <p className="mt-1 text-yellow-800">{warning.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CanonViolationCard({
  violation,
}: {
  violation: CanonCheckResult['violations'][number];
}) {
  const config = getCanonSeverityConfig(violation.severity);

  return (
    <div className={`rounded-md border p-3 ${config.bgClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <config.icon className={`h-4 w-4 ${config.iconClass}`} />
            <span className="font-medium text-sm">{violation.rule}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${config.badgeClass}`}>
              {violation.severity}
            </span>
          </div>
          {violation.location && (
            <p className="text-xs text-muted-foreground mb-1">
              <span className="font-medium">Location:</span> {violation.location}
            </p>
          )}
          <div className="text-xs space-y-0.5">
            <p>
              <span className="font-medium">Expected:</span>{' '}
              <code className="bg-white/50 px-1 rounded">{JSON.stringify(violation.expected)}</code>
            </p>
            <p>
              <span className="font-medium">Actual:</span>{' '}
              <code className="bg-white/50 px-1 rounded">{JSON.stringify(violation.actual)}</code>
            </p>
          </div>
          {violation.suggestion && (
            <p className="text-xs mt-2 text-muted-foreground">
              <span className="font-medium">Suggestion:</span> {violation.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function getCanonSeverityConfig(severity: CanonCheckResult['violations'][number]['severity']) {
  switch (severity) {
    case 'error':
      return {
        icon: XCircle,
        iconClass: 'text-red-600',
        bgClass: 'bg-red-50 border-red-200',
        badgeClass: 'bg-red-100 text-red-700',
      };
    case 'warning':
      return {
        icon: AlertCircle,
        iconClass: 'text-yellow-600',
        bgClass: 'bg-yellow-50 border-yellow-200',
        badgeClass: 'bg-yellow-100 text-yellow-700',
      };
    case 'info':
      return {
        icon: Info,
        iconClass: 'text-blue-600',
        bgClass: 'bg-blue-50 border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-700',
      };
  }
}

// ============================================================
// Safety Review Report — Dua Lapis Terpisah
// ============================================================

function SafetyReviewReport({ safetyResult }: { safetyResult: SafetyCheckResult }) {
  return (
    <div className="space-y-4">
      {/* Lapis 1: Baseline Policy — HARD-BLOCK */}
      <div className="rounded-lg border-2 border-red-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold">Baseline Platform Policy</h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Wajib Diperbaiki
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Aturan universal yang berlaku ke SEMUA universe apapun rating-nya.
          Violation di sini akan <strong>hard-block</strong> export — video tidak boleh
          di-export otomatis sampai diperbaiki.
        </p>

        {safetyResult.baselinePolicyFindings.length === 0 ? (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Tidak ada baseline policy violation.
          </div>
        ) : (
          <div className="space-y-2">
            {safetyResult.baselinePolicyFindings.map((finding, i) => (
              <SafetyFindingCard key={i} finding={finding} isBaseline />
            ))}
          </div>
        )}
      </div>

      {/* Lapis 2: Rating-Consistency — WARNING/INFO */}
      <div className="rounded-lg border-2 border-yellow-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold">Rating-Consistency Check</h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Sekadar Informasi
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Membandingkan output dengan <code className="bg-white/50 px-1 rounded">contentRating</code> universe
          ({safetyResult.contentRating}). Hasil di sini adalah <strong>warning/info</strong>,
          bukan hard-block — creator tetap bisa export dengan kesadaran penuh.
          {safetyResult.llmClassifierUsed
            ? ' (LLM classifier digunakan)'
            : ' (LLM classifier tidak digunakan — baseline policy saja)'}
        </p>

        {safetyResult.ratingConsistencyFindings.length === 0 ? (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Tidak ada rating-consistency finding.
          </div>
        ) : (
          <div className="space-y-2">
            {safetyResult.ratingConsistencyFindings.map((finding, i) => (
              <SafetyFindingCard key={i} finding={finding} isBaseline={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SafetyFindingCard({
  finding,
  isBaseline,
}: {
  finding: SafetyFinding;
  isBaseline: boolean;
}) {
  const config = getSafetySeverityConfig(finding.severity);

  return (
    <div className={`rounded-md border p-3 ${config.bgClass}`}>
      <div className="flex items-start gap-2">
        <config.icon className={`h-4 w-4 mt-0.5 ${config.iconClass}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{finding.category}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${config.badgeClass}`}>
              {finding.severity}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {finding.ruleId}
            </span>
            {isBaseline && (
              <span className="text-xs text-red-600 font-medium">· Hard-block</span>
            )}
          </div>
          <p className="text-sm">{finding.message}</p>
          {finding.location && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">Location:</span> {finding.location}
            </p>
          )}
          {finding.suggestion && (
            <p className="text-xs mt-2 text-muted-foreground">
              <span className="font-medium">Suggestion:</span> {finding.suggestion}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Confidence: {(finding.confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function getSafetySeverityConfig(severity: SafetyFinding['severity']) {
  switch (severity) {
    case 'block':
      return {
        icon: XCircle,
        iconClass: 'text-red-600',
        bgClass: 'bg-red-50 border-red-200',
        badgeClass: 'bg-red-100 text-red-700',
      };
    case 'warning':
      return {
        icon: AlertCircle,
        iconClass: 'text-yellow-600',
        bgClass: 'bg-yellow-50 border-yellow-200',
        badgeClass: 'bg-yellow-100 text-yellow-700',
      };
    case 'info':
      return {
        icon: Info,
        iconClass: 'text-blue-600',
        bgClass: 'bg-blue-50 border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-700',
      };
  }
}

// ============================================================
// Approval Actions
// ============================================================

function ApprovalActions({
  approvalType,
  feedback,
  setFeedback,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  approveError,
  rejectError,
  approveSuccess,
}: {
  approvalType: ReviewWorkflowResult['approvalType'];
  feedback: string;
  setFeedback: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  approveError: Error | null;
  rejectError: Error | null;
  approveSuccess: boolean;
}) {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Gavel className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">
          Review Decision
          {approvalType === 'MANDATORY' && (
            <span className="ml-2 text-xs font-normal text-red-600">(Mandatory)</span>
          )}
          {approvalType === 'OPTIONAL' && (
            <span className="ml-2 text-xs font-normal text-yellow-600">(Optional)</span>
          )}
        </h3>
      </div>

      {approvalType === 'MANDATORY' && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Approval wajib diperlukan karena ada baseline policy violation atau canon error.
          Tolak kalau masalah belum diperbaiki.
        </div>
      )}

      {approvalType === 'OPTIONAL' && (
        <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-700 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Approval opsional — ini hanya rating-consistency warning, bukan hard-block.
          Kamu tetap bisa approve untuk lanjut ke export.
        </div>
      )}

      {/* Feedback Input */}
      <div>
        <label className="text-sm font-medium">Feedback (opsional)</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tulis feedback untuk creator..."
          rows={3}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onApprove}
          disabled={isApproving || isRejecting}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isApproving ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Approve
            </>
          )}
        </button>
        <button
          onClick={onReject}
          disabled={isApproving || isRejecting}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isRejecting ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Rejecting...
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              Reject
            </>
          )}
        </button>
      </div>

      {/* Error Messages */}
      {approveError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Error: {approveError.message}
        </div>
      )}
      {rejectError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Error: {rejectError.message}
        </div>
      )}

      {/* Success Message */}
      {approveSuccess && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Review approved — video siap untuk export!
        </div>
      )}
    </div>
  );
}

// ============================================================
// Audit Trail
// ============================================================

function AuditTrail({ logs }: { logs: SafetyReviewLogEntry[] }) {
  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Audit Trail</h3>
        <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <AuditLogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}

function AuditLogEntry({ log }: { log: SafetyReviewLogEntry }) {
  const statusConfig = getLogStatusConfig(log.status);
  const severityConfig = getLogSeverityConfig(log.severity);

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-1.5 py-0.5 rounded ${statusConfig.badgeClass}`}>
          {log.status}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${severityConfig.badgeClass}`}>
          {log.severity}
        </span>
        <span className="text-xs text-muted-foreground">{log.layer}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm">{log.message}</p>
      {log.flaggedRule && (
        <p className="text-xs text-muted-foreground mt-1 font-mono">Rule: {log.flaggedRule}</p>
      )}
      {log.feedback && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Feedback:</span> {log.feedback}
        </p>
      )}
      {log.reviewer && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Reviewer:</span> {log.reviewer.name ?? log.reviewer.email}
        </p>
      )}
      {log.decidedAt && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Decided:</span> {new Date(log.decidedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function getLogStatusConfig(status: SafetyReviewLogEntry['status']) {
  switch (status) {
    case 'PENDING':
      return { badgeClass: 'bg-yellow-100 text-yellow-700' };
    case 'APPROVED':
      return { badgeClass: 'bg-green-100 text-green-700' };
    case 'REJECTED':
      return { badgeClass: 'bg-red-100 text-red-700' };
    case 'AUTO_PASSED':
      return { badgeClass: 'bg-blue-100 text-blue-700' };
    case 'AUTO_BLOCKED':
      return { badgeClass: 'bg-red-100 text-red-700' };
    default:
      return { badgeClass: 'bg-gray-100 text-gray-700' };
  }
}

function getLogSeverityConfig(severity: SafetyReviewLogEntry['severity']) {
  switch (severity) {
    case 'BLOCK':
      return { badgeClass: 'bg-red-100 text-red-700' };
    case 'WARNING':
      return { badgeClass: 'bg-yellow-100 text-yellow-700' };
    case 'INFO':
      return { badgeClass: 'bg-blue-100 text-blue-700' };
    default:
      return { badgeClass: 'bg-gray-100 text-gray-700' };
  }
}