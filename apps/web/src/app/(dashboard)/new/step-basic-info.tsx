'use client';

import { Input, Label, Textarea } from '@suro-buya/ui';
import { slugify, type WizardData } from './types';

interface StepProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepBasicInfo({ data, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Info Dasar</h2>
        <p className="text-sm text-muted-foreground">
          Mulai dengan nama universe dan deskripsi singkatnya.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nama Universe</Label>
        <Input
          id="name"
          placeholder="mis. Suro & Buya"
          value={data.name}
          onChange={(e) => {
            const name = e.target.value;
            // Auto-derive slug from name unless the user has customized it away
            // from what auto-derivation would have produced.
            const shouldAutoSlug = data.slug === '' || data.slug === slugify(data.name);
            onChange({ name, ...(shouldAutoSlug ? { slug: slugify(name) } : {}) });
          }}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          placeholder="suro-buya"
          value={data.slug}
          onChange={(e) => onChange({ slug: slugify(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Digunakan di URL. Hanya huruf kecil, angka, dan tanda hubung.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi Singkat</Label>
        <Textarea
          id="description"
          placeholder="Ceritakan garis besar universe ini dalam 1-2 kalimat..."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={4}
        />
      </div>
    </div>
  );
}
