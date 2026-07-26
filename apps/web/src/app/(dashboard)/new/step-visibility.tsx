'use client';

import { Lock, Globe } from 'lucide-react';
import { cn } from '@suro-buya/ui';
import type { WizardData } from './types';

interface StepProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepVisibility({ data, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Visibilitas & Akses</h2>
        <p className="text-sm text-muted-foreground">
          Anda akan menjadi <strong>Owner</strong> universe ini dan bisa mengundang anggota
          tim lain (Editor, Reviewer, Viewer) setelah universe dibuat.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange({ isPublic: false })}
          className={cn(
            'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
            !data.isPublic
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'hover:bg-accent'
          )}
        >
          <Lock className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Privat</span>
          <span className="text-sm text-muted-foreground">
            Hanya anggota yang diundang yang bisa melihat & mengakses universe ini.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange({ isPublic: true })}
          className={cn(
            'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
            data.isPublic
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'hover:bg-accent'
          )}
        >
          <Globe className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Publik</span>
          <span className="text-sm text-muted-foreground">
            Siapa saja bisa melihat universe bible ini (mode read-only untuk non-anggota).
          </span>
        </button>
      </div>
    </div>
  );
}
