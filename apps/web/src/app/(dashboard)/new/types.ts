import type { CharacterRole } from '@/lib/api-client';

export interface WizardCharacter {
  characterId: string;
  name: string;
  displayName: string;
  role: CharacterRole;
  coreWeakness: string;
}

export interface WizardData {
  // Step 1 — Basic Info
  name: string;
  slug: string;
  description: string;

  // Step 2 — Setting & Audience
  targetAgeMin: number;
  targetAgeMax: number;
  setting: string;
  culturalContext: string;

  // Step 3 — Initial Characters (optional)
  characters: WizardCharacter[];

  // Step 4 — Visibility
  isPublic: boolean;
}

export const initialWizardData: WizardData = {
  name: '',
  slug: '',
  description: '',
  targetAgeMin: 7,
  targetAgeMax: 12,
  setting: '',
  culturalContext: '',
  characters: [],
  isPublic: false,
};

export const CHARACTER_ROLE_OPTIONS: { value: CharacterRole; label: string }[] = [
  { value: 'PROTAGONIST', label: 'Protagonis' },
  { value: 'DEUTERAGONIST', label: 'Deuteragonis' },
  { value: 'SUPPORTING', label: 'Pendukung' },
  { value: 'ANTAGONIST', label: 'Antagonis' },
  { value: 'NARRATOR', label: 'Narator' },
];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
