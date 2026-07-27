import * as React from 'react';
import { Loader2, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'cancelled';

export interface ProgressStreamProps {
  /** Current lifecycle status of the generation stream. */
  status: StreamStatus;
  /** Coarse progress 0-100. */
  progress?: number;
  /** Human-readable label for what's happening right now. */
  currentStep?: string;
  /** Accumulated streamed text so far. */
  streamedText?: string;
  /** Error message when status === 'error'. */
  errorMessage?: string;
  /** Shown when the user can cancel an in-flight generation. */
  onCancel?: () => void;
  /** Max height (Tailwind class) for the streamed-text panel. */
  maxHeightClassName?: string;
  className?: string;
}

const STATUS_LABEL: Record<StreamStatus, string> = {
  idle: 'Menunggu',
  connecting: 'Menghubungkan ke AI provider...',
  streaming: 'Menulis...',
  done: 'Selesai',
  error: 'Gagal',
  cancelled: 'Dibatalkan',
};

/**
 * Generic SSE-generation progress display: progress bar + status + a live
 * streamed-text panel with a blinking cursor while text is still arriving.
 * Deliberately has no knowledge of *how* the stream is produced (fetch, SSE,
 * websockets) — the parent owns that and just feeds this component state.
 */
export function ProgressStream({
  status,
  progress = 0,
  currentStep,
  streamedText = '',
  errorMessage,
  onCancel,
  maxHeightClassName = 'max-h-72',
  className,
}: ProgressStreamProps) {
  const isActive = status === 'connecting' || status === 'streaming';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {isActive && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
          {status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
          {status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
          {status === 'cancelled' && <Ban className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate text-foreground">{currentStep || STATUS_LABEL[status]}</span>
        </div>
        {isActive && onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Batalkan
          </Button>
        )}
      </div>

      <Progress value={status === 'done' ? 100 : progress} />

      {status === 'error' && errorMessage && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {streamedText && (
        <pre
          className={cn(
            'overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground',
            maxHeightClassName
          )}
        >
          {streamedText}
          {status === 'streaming' && <span className="animate-pulse">▍</span>}
        </pre>
      )}
    </div>
  );
}
