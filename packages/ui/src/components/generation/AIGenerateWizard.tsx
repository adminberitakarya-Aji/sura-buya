import * as React from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/select';
import { ProgressStream, type StreamStatus } from './ProgressStream';
import { cn } from '../../lib/utils';

export interface WizardOption {
  id: string;
  name: string;
}

export interface GenerateWizardValues {
  premise: string;
  characters: string[];
  region?: string;
  specialInstructions?: string;
  temperature?: number;
}

const STEPS = [
  { step: 1, label: 'Premise' },
  { step: 2, label: 'Konteks' },
  { step: 3, label: 'Generate' },
  { step: 4, label: 'Review' },
] as const;

export interface AIGenerateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Scene 3" — shown in the dialog title. */
  sceneLabel: string;
  initialValues: GenerateWizardValues;
  availableCharacters: WizardOption[];
  availableRegions: WizardOption[];

  /** Live streaming state — owned by the parent (it knows how the SSE call works). */
  status: StreamStatus;
  progress?: number;
  currentStep?: string;
  streamedText?: string;
  errorMessage?: string;
  /** Final text once generation finishes; editable in the Review step. */
  finalText?: string;

  onGenerate: (values: GenerateWizardValues) => void;
  onCancelGenerate?: () => void;
  /** Called from the Review step with the (possibly edited) final text. */
  onAccept: (finalText: string) => void;
  isSaving?: boolean;
}

/**
 * 4-step wizard: Premise -> Context -> Generate -> Review.
 * This component only renders UI and calls back to the parent for the
 * actual generation call — it has no knowledge of SSE/fetch/API shape,
 * so it can be reused by any app that wants an AI-generation flow.
 */
export function AIGenerateWizard({
  open,
  onOpenChange,
  sceneLabel,
  initialValues,
  availableCharacters,
  availableRegions,
  status,
  progress = 0,
  currentStep,
  streamedText = '',
  errorMessage,
  finalText,
  onGenerate,
  onCancelGenerate,
  onAccept,
  isSaving = false,
}: AIGenerateWizardProps) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [values, setValues] = React.useState<GenerateWizardValues>(initialValues);
  const [editedText, setEditedText] = React.useState('');
  const hasAutoAdvanced = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setValues(initialValues);
    hasAutoAdvanced.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (status === 'done' && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      setEditedText(finalText ?? streamedText);
      setStep(4);
    }
  }, [status, finalText, streamedText]);

  function toggleCharacter(id: string) {
    setValues((v) => ({
      ...v,
      characters: v.characters.includes(id)
        ? v.characters.filter((c) => c !== id)
        : [...v.characters, id],
    }));
  }

  function handleStartGenerate() {
    hasAutoAdvanced.current = false;
    setStep(3);
    onGenerate(values);
  }

  function handleRegenerate() {
    hasAutoAdvanced.current = false;
    setStep(2);
  }

  const isGenerating = status === 'connecting' || status === 'streaming';

  return (
    <Dialog open={open} onOpenChange={(next) => !isGenerating && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate {sceneLabel}</DialogTitle>
          <DialogDescription>
            Ikuti 4 langkah untuk generate isi scene dengan AI, lalu review sebelum disimpan.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map(({ step: s, label }, idx) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : step > s
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step > s ? <Check className="h-3.5 w-3.5" /> : s}
                </div>
                <span
                  className={cn(
                    'hidden text-xs sm:inline',
                    step === s ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Premise */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wizard-premise">Premise Scene</Label>
              <Textarea
                id="wizard-premise"
                rows={4}
                value={values.premise}
                onChange={(e) => setValues((v) => ({ ...v, premise: e.target.value }))}
                placeholder="Apa yang terjadi di scene ini?"
              />
            </div>

            {availableRegions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Lokasi / Region</Label>
                <Select
                  value={values.region || undefined}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, region: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih region..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRegions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Karakter yang Muncul</Label>
              <div className="flex flex-wrap gap-1.5">
                {availableCharacters.map((c) => {
                  const active = values.characters.includes(c.id);
                  return (
                    <Badge
                      key={c.id}
                      variant={active ? 'default' : 'outline'}
                      className="cursor-pointer select-none font-normal"
                      onClick={() => toggleCharacter(c.id)}
                    >
                      {c.name}
                    </Badge>
                  );
                })}
                {availableCharacters.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Belum ada karakter di universe ini.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Context */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="mb-2 font-medium text-foreground">Konteks yang akan dikirim ke AI:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  Karakter:{' '}
                  {values.characters.length > 0
                    ? values.characters
                        .map((id) => availableCharacters.find((c) => c.id === id)?.name ?? id)
                        .join(', ')
                    : 'Tidak ada karakter dipilih'}
                </li>
                <li>
                  Region:{' '}
                  {values.region
                    ? (availableRegions.find((r) => r.id === values.region)?.name ?? values.region)
                    : 'Tidak ditentukan'}
                </li>
                <li>Character bible, world bible, dan story bible universe otomatis disertakan.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wizard-instructions">Instruksi Tambahan (opsional)</Label>
              <Textarea
                id="wizard-instructions"
                rows={3}
                value={values.specialInstructions ?? ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, specialInstructions: e.target.value }))
                }
                placeholder="Contoh: fokus ke humor, hindari dialog panjang, dsb."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wizard-temperature">Kreativitas (temperature)</Label>
              <Input
                id="wizard-temperature"
                type="number"
                min={0}
                max={1.5}
                step={0.1}
                value={values.temperature ?? 0.7}
                onChange={(e) =>
                  setValues((v) => ({ ...v, temperature: Number(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Rendah = lebih konsisten dengan canon. Tinggi = lebih kreatif/variatif.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Generate */}
        {step === 3 && (
          <ProgressStream
            status={status}
            progress={progress}
            currentStep={currentStep}
            streamedText={streamedText}
            errorMessage={errorMessage}
            onCancel={onCancelGenerate}
          />
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <Label htmlFor="wizard-review">
              Hasil Generate — edit dulu kalau perlu sebelum disimpan
            </Label>
            <Textarea
              id="wizard-review"
              rows={12}
              className="font-mono text-xs"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
            />
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {step > 1 && step < 4 && !isGenerating && (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>
                <ChevronLeft className="h-4 w-4" />
                Kembali
              </Button>
            )}
            {step === 4 && (
              <Button variant="ghost" onClick={handleRegenerate}>
                <RotateCcw className="h-4 w-4" />
                Generate Ulang
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!values.premise.trim()}>
                Lanjut
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleStartGenerate}>
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            )}
            {step === 3 && status === 'done' && (
              <Button onClick={() => setStep(4)}>
                Lanjut ke Review
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={() => onAccept(editedText)} disabled={isSaving || !editedText.trim()}>
                <Check className="h-4 w-4" />
                Simpan Scene
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
