import * as React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface ValidationIssue {
  /** Where in the scene the issue was found, e.g. "scene.characters: buya". */
  path: string;
  /** Human-readable explanation. */
  message: string;
  /** Rule/criterion id, e.g. "no-violence" or "llm-judge:characterConsistency". */
  code: string;
}

export interface CanonValidationSummary {
  valid: boolean;
  /** 0-1 overall consistency score. */
  consistencyScore: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export type ValidatorStatus = 'idle' | 'running' | 'done' | 'error';

export interface CanonValidatorPanelProps {
  status: ValidatorStatus;
  result?: CanonValidationSummary;
  errorMessage?: string;
  onRunValidation?: () => void;
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 0.85) return 'text-emerald-600';
  if (score >= 0.6) return 'text-amber-600';
  return 'text-destructive';
}

function IssueGroup({
  title,
  icon,
  issues,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  issues: ValidationIssue[];
  tone: 'destructive' | 'warning' | 'info';
}) {
  if (issues.length === 0) return null;

  const toneClass =
    tone === 'destructive'
      ? 'border-destructive/30 bg-destructive/5'
      : tone === 'warning'
        ? 'border-amber-300/50 bg-amber-50 dark:bg-amber-950/20'
        : 'border-border bg-muted/30';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon}
        {title} ({issues.length})
      </div>
      <div className="space-y-1.5">
        {issues.map((issue, idx) => (
          <div key={`${issue.code}-${idx}`} className={cn('rounded-md border p-2.5 text-xs', toneClass)}>
            <p className="font-mono text-[10px] text-muted-foreground">{issue.code}</p>
            <p className="mt-0.5 text-foreground">{issue.message}</p>
            {issue.path && (
              <p className="mt-0.5 text-muted-foreground">lokasi: {issue.path}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Displays canon validation results (rule-engine + LLM judge) grouped by
 * severity, with a consistency score and a re-run button. Purely
 * presentational — the parent owns the actual validate() API call.
 */
export function CanonValidatorPanel({
  status,
  result,
  errorMessage,
  onRunValidation,
  className,
}: CanonValidatorPanelProps) {
  const isRunning = status === 'running';
  const totalIssues = result ? result.errors.length + result.warnings.length + result.infos.length : 0;

  return (
    <div className={cn('space-y-3 rounded-lg border p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {result?.valid && totalIssues === 0 ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          )}
          Canon Validator
          {result && (
            <span className={cn('text-xs font-semibold', scoreColor(result.consistencyScore))}>
              {Math.round(result.consistencyScore * 100)}%
            </span>
          )}
        </div>
        {onRunValidation && (
          <Button type="button" size="sm" variant="outline" onClick={onRunValidation} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {result ? 'Validasi Ulang' : 'Jalankan Validasi'}
          </Button>
        )}
      </div>

      {status === 'idle' && !result && (
        <p className="text-xs text-muted-foreground">
          Belum divalidasi. Jalankan validator untuk mengecek konsistensi terhadap character
          bible, world bible, dan canon rule universe ini.
        </p>
      )}

      {status === 'error' && (
        <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {errorMessage ?? 'Validasi gagal.'}
        </p>
      )}

      {result && totalIssues === 0 && result.valid && (
        <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
          Semua canon rule terpenuhi — tidak ada pelanggaran ditemukan.
        </p>
      )}

      {result && totalIssues > 0 && (
        <div className="space-y-3">
          <IssueGroup
            title="Error"
            tone="destructive"
            icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
            issues={result.errors}
          />
          <IssueGroup
            title="Warning"
            tone="warning"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            issues={result.warnings}
          />
          <IssueGroup
            title="Info"
            tone="info"
            icon={<Info className="h-3.5 w-3.5 text-muted-foreground" />}
            issues={result.infos}
          />
        </div>
      )}
    </div>
  );
}
