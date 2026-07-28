import * as React from 'react';
import { Check, MessageSquareWarning, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { cn } from '../../lib/utils';
import { diffWords } from '../../lib/diff';

export interface SceneVersionOption {
  version: number;
  content: string;
  createdAt: string;
}

export type ReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export interface ReviewEntry {
  id: string;
  reviewerName: string;
  decision: ReviewDecision;
  feedback?: string | null;
  createdAt: string;
}

export interface ReviewPackageProps {
  sceneLabel: string;
  /** Ascending order (oldest first). */
  versions: SceneVersionOption[];
  reviews: ReviewEntry[];
  onSubmitReview: (decision: ReviewDecision, feedback: string) => void;
  isSubmitting?: boolean;
  className?: string;
}

const DECISION_LABEL: Record<ReviewDecision, string> = {
  APPROVE: 'Disetujui',
  REQUEST_CHANGES: 'Minta Perbaikan',
  REJECT: 'Ditolak',
};

const DECISION_BADGE: Record<ReviewDecision, 'default' | 'secondary' | 'destructive'> = {
  APPROVE: 'default',
  REQUEST_CHANGES: 'secondary',
  REJECT: 'destructive',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Review Package: pick two versions to diff side-by-side, read past review
 * history, and submit a new Approve / Request Changes / Reject decision
 * with feedback. Purely presentational — the parent owns fetching versions
 * / reviews and the actual submit API call.
 */
export function ReviewPackage({
  sceneLabel,
  versions,
  reviews,
  onSubmitReview,
  isSubmitting = false,
  className,
}: ReviewPackageProps) {
  const [fromVersion, setFromVersion] = React.useState<number | undefined>(
    versions.length >= 2 ? versions[versions.length - 2].version : versions[0]?.version
  );
  const [toVersion, setToVersion] = React.useState<number | undefined>(
    versions[versions.length - 1]?.version
  );
  const [feedback, setFeedback] = React.useState('');

  const fromContent = versions.find((v) => v.version === fromVersion)?.content ?? '';
  const toContent = versions.find((v) => v.version === toVersion)?.content ?? '';

  const diff = React.useMemo(
    () => (fromVersion !== toVersion ? diffWords(fromContent, toContent) : []),
    [fromContent, toContent, fromVersion, toVersion]
  );

  const hasDiff = fromVersion !== undefined && toVersion !== undefined && fromVersion !== toVersion;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">{sceneLabel}</span>

        {versions.length > 1 && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Bandingkan
              <Select
                value={fromVersion !== undefined ? String(fromVersion) : undefined}
                onValueChange={(v) => setFromVersion(Number(v))}
              >
                <SelectTrigger className="h-7 w-24">
                  <SelectValue placeholder="v?" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      v{v.version} · {formatDate(v.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              dengan
              <Select
                value={toVersion !== undefined ? String(toVersion) : undefined}
                onValueChange={(v) => setToVersion(Number(v))}
              >
                <SelectTrigger className="h-7 w-24">
                  <SelectValue placeholder="v?" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      v{v.version} · {formatDate(v.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Side-by-side diff */}
      {hasDiff ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border">
            <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Versi {fromVersion}
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">
              {diff
                .filter((op) => op.type !== 'add')
                .map((op, idx) => (
                  <span
                    key={idx}
                    className={
                      op.type === 'remove'
                        ? 'rounded bg-destructive/15 text-destructive line-through'
                        : undefined
                    }
                  >
                    {op.value}
                  </span>
                ))}
            </pre>
          </div>
          <div className="rounded-md border">
            <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Versi {toVersion}
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">
              {diff
                .filter((op) => op.type !== 'remove')
                .map((op, idx) => (
                  <span
                    key={idx}
                    className={
                      op.type === 'add'
                        ? 'rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : undefined
                    }
                  >
                    {op.value}
                  </span>
                ))}
            </pre>
          </div>
        </div>
      ) : (
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
          {toContent || fromContent || 'Belum ada konten.'}
        </pre>
      )}

      {/* Decision */}
      <div className="space-y-2">
        <Textarea
          placeholder="Catatan review (opsional untuk approve, disarankan untuk request changes/reject)..."
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSubmitReview('APPROVE', feedback)}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onSubmitReview('REQUEST_CHANGES', feedback)}
          >
            <MessageSquareWarning className="h-4 w-4" />
            Minta Perbaikan
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => onSubmitReview('REJECT', feedback)}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>

      {/* Review history */}
      {reviews.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Riwayat Review</p>
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-md border p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{r.reviewerName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={DECISION_BADGE[r.decision]}>{DECISION_LABEL[r.decision]}</Badge>
                    <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
                {r.feedback && <p className="mt-1 text-muted-foreground">{r.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
