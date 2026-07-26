'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  Badge,
} from '@suro-buya/ui';
import { CHARACTER_ROLE_OPTIONS, slugify, type WizardCharacter, type WizardData } from './types';

interface StepProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const emptyDraft = {
  name: '',
  role: 'PROTAGONIST' as WizardCharacter['role'],
  coreWeakness: '',
};

export function StepCharacters({ data, onChange }: StepProps) {
  const [draft, setDraft] = useState(emptyDraft);

  function addCharacter() {
    if (!draft.name.trim() || !draft.coreWeakness.trim()) return;

    const newCharacter: WizardCharacter = {
      characterId: slugify(draft.name),
      name: draft.name.trim(),
      displayName: draft.name.trim(),
      role: draft.role,
      coreWeakness: draft.coreWeakness.trim(),
    };

    onChange({ characters: [...data.characters, newCharacter] });
    setDraft(emptyDraft);
  }

  function removeCharacter(characterId: string) {
    onChange({ characters: data.characters.filter((c) => c.characterId !== characterId) });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Karakter Awal</h2>
        <p className="text-sm text-muted-foreground">
          Opsional — tambahkan karakter utama sekarang, atau lewati dan tambahkan nanti dari
          Character Manager.
        </p>
      </div>

      {data.characters.length > 0 && (
        <div className="space-y-2">
          {data.characters.map((c) => (
            <Card key={c.characterId}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="secondary">
                      {CHARACTER_ROLE_OPTIONS.find((r) => r.value === c.role)?.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Kelemahan: {c.coreWeakness}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCharacter(c.characterId)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Hapus {c.name}</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="charName">Nama Karakter</Label>
              <Input
                id="charName"
                placeholder="mis. Suro"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charRole">Peran</Label>
              <Select
                value={draft.role}
                onValueChange={(role) =>
                  setDraft({ ...draft, role: role as WizardCharacter['role'] })
                }
              >
                <SelectTrigger id="charRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="charWeakness">Kelemahan Utama</Label>
            <Input
              id="charWeakness"
              placeholder="mis. Terlalu impulsif"
              value={draft.coreWeakness}
              onChange={(e) => setDraft({ ...draft, coreWeakness: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addCharacter}
            disabled={!draft.name.trim() || !draft.coreWeakness.trim()}
          >
            <Plus className="h-4 w-4" />
            Tambah Karakter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
