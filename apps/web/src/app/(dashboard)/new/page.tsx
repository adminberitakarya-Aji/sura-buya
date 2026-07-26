'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button, Progress } from '@suro-buya/ui';
import { universesApi, charactersApi } from '@/lib/api-client';
import { initialWizardData, type WizardData } from './types';
import { StepBasicInfo } from './step-basic-info';
import { StepSetting } from './step-setting';
import { StepCharacters } from './step-characters';
import { StepVisibility } from './step-visibility';
import { StepReview } from './step-review';

const STEPS = [
  { title: 'Info Dasar' },
  { title: 'Setting' },
  { title: 'Karakter' },
  { title: 'Visibilitas' },
  { title: 'Review' },
];

function isStepValid(step: number, data: WizardData): boolean {
  switch (step) {
    case 0:
      return data.name.trim().length > 0 && /^[a-z0-9-]+$/.test(data.slug);
    default:
      return true;
  }
}

export default function CreateUniverseWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialWizardData);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { universe } = await universesApi.create({
        slug: data.slug,
        name: data.name,
        description: data.description || undefined,
        isPublic: data.isPublic,
        manifest: {
          targetAge: { min: data.targetAgeMin, max: data.targetAgeMax },
          setting: data.setting,
          culturalContext: data.culturalContext,
        },
      });

      // Create any characters added in step 3. Best-effort: if one fails we
      // still land the user on the universe (they can retry from Character
      // Manager) rather than losing the whole universe creation.
      await Promise.allSettled(
        data.characters.map((c) =>
          charactersApi.create(universe.id, {
            characterId: c.characterId,
            name: c.name,
            displayName: c.displayName,
            role: c.role,
            coreWeakness: c.coreWeakness,
          })
        )
      );

      return universe;
    },
    onSuccess: (universe) => {
      router.push(`/${universe.id}`);
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : 'Gagal membuat universe.');
    },
  });

  function patch(p: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...p }));
  }

  function next() {
    if (step === STEPS.length - 1) {
      setSubmitError(null);
      createMutation.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const canProceed = isStepValid(step, data);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Langkah {step + 1} dari {STEPS.length}: {STEPS[step].title}
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="rounded-xl border bg-card p-6">
        {step === 0 && <StepBasicInfo data={data} onChange={patch} />}
        {step === 1 && <StepSetting data={data} onChange={patch} />}
        {step === 2 && <StepCharacters data={data} onChange={patch} />}
        {step === 3 && <StepVisibility data={data} onChange={patch} />}
        {step === 4 && <StepReview data={data} />}

        {submitError && (
          <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={back}
            disabled={step === 0 || createMutation.isPending}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>

          <Button type="button" onClick={next} disabled={!canProceed || createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === STEPS.length - 1 ? (
              <Check className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {step === STEPS.length - 1 ? 'Buat Universe' : 'Lanjut'}
          </Button>
        </div>
      </div>
    </div>
  );
}
