'use client';

import { Input, Label, Textarea } from '@suro-buya/ui';
import type { WizardData } from './types';

interface StepProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepSetting({ data, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Setting & Target Audiens</h2>
        <p className="text-sm text-muted-foreground">
          Bantu AI memahami dunia dan pembaca yang dituju universe ini.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ageMin">Usia Target (dari)</Label>
          <Input
            id="ageMin"
            type="number"
            min={0}
            max={18}
            value={data.targetAgeMin}
            onChange={(e) => onChange({ targetAgeMin: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ageMax">Usia Target (sampai)</Label>
          <Input
            id="ageMax"
            type="number"
            min={0}
            max={18}
            value={data.targetAgeMax}
            onChange={(e) => onChange({ targetAgeMax: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="setting">Setting / Dunia Cerita</Label>
        <Textarea
          id="setting"
          placeholder="mis. Nusantara modern-fantasy, kota pesisir Jawa Timur yang penuh legenda..."
          value={data.setting}
          onChange={(e) => onChange({ setting: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="culturalContext">Konteks Budaya</Label>
        <Textarea
          id="culturalContext"
          placeholder="mis. Mengangkat legenda dan kearifan lokal Jawa Timur..."
          value={data.culturalContext}
          onChange={(e) => onChange({ culturalContext: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
