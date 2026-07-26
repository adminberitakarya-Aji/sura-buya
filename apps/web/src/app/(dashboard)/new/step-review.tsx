'use client';

import { CHARACTER_ROLE_OPTIONS, type WizardData } from './types';

export function StepReview({ data }: { data: WizardData }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-sm text-muted-foreground">
          Periksa sekali lagi sebelum universe dibuat.
        </p>
      </div>

      <dl className="divide-y rounded-lg border">
        <ReviewRow label="Nama">{data.name || '—'}</ReviewRow>
        <ReviewRow label="Slug">{data.slug || '—'}</ReviewRow>
        <ReviewRow label="Deskripsi">{data.description || '—'}</ReviewRow>
        <ReviewRow label="Target Usia">
          {data.targetAgeMin}–{data.targetAgeMax} tahun
        </ReviewRow>
        <ReviewRow label="Setting">{data.setting || '—'}</ReviewRow>
        <ReviewRow label="Konteks Budaya">{data.culturalContext || '—'}</ReviewRow>
        <ReviewRow label="Karakter Awal">
          {data.characters.length === 0
            ? 'Tidak ada — bisa ditambahkan nanti'
            : data.characters
                .map(
                  (c) =>
                    `${c.name} (${CHARACTER_ROLE_OPTIONS.find((r) => r.value === c.role)?.label})`
                )
                .join(', ')}
        </ReviewRow>
        <ReviewRow label="Visibilitas">{data.isPublic ? 'Publik' : 'Privat'}</ReviewRow>
      </dl>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}
