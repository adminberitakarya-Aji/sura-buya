/**
 * Suro-Buya Engine v2 - Character Reference Generator (VF-1.6)
 *
 * Generate 3-5 reference image (turnaround: tampak depan, profil 3/4,
 * pose full body, ekspresi) dari persona final karakter (PersonaDraft / Character).
 *
 * Menggunakan ImageProvider / MediaProviderRegistry dari media-providers (VF-1.4)
 * untuk melakukan image generation secara provider-agnostic. Hasilnya berupa
 * array URL gambar referensi yang siap disimpan ke `CharacterAsset.referenceImages`.
 */

import type { PersonaDraft } from '@suro-buya/shared';
import type { ImageProvider } from '../ai/media-providers/types.js';
import { MediaProviderRegistry } from '../ai/media-providers/registry.js';
import { MockImageProvider } from '../ai/media-providers/mock-providers.js';

export interface ReferenceAngleSpec {
  angle: 'front-portrait' | 'side-profile' | 'full-body' | 'action-expression' | 'back-detail';
  description: string;
  cameraPrompt: string;
}

export const DEFAULT_REFERENCE_ANGLES: ReferenceAngleSpec[] = [
  {
    angle: 'front-portrait',
    description: 'Tampak depan close-up, fokus ke wajah dan ekspresi netral',
    cameraPrompt: 'front-facing portrait, close-up shot, neutral expression, detailed face and eyes',
  },
  {
    angle: 'side-profile',
    description: 'Tampak samping 3/4, posisi berdiri santai',
    cameraPrompt: 'three-quarter side profile view, medium shot, relaxed standing pose',
  },
  {
    angle: 'full-body',
    description: 'Tampak seluruh badan (full body turnaround), menampilkan pakaian dan proporsi',
    cameraPrompt: 'full body turnaround shot, standing pose, clear view of outfit and head-to-toe proportions',
  },
  {
    angle: 'action-expression',
    description: 'Pose ekspresif sesuai sifat inti karakter',
    cameraPrompt: 'dynamic action pose with expressive emotion matching character personality',
  },
];

export interface ReferencePromptInput {
  displayName: string;
  species: string;
  ageDescriptor: string;
  visualDescription: string;
  coreTraits?: string[];
  artStyle?: string;
  negativePrompt?: string;
}

export interface GeneratedPromptSpec {
  angle: ReferenceAngleSpec['angle'];
  prompt: string;
  description: string;
}

export interface ReferenceGeneratorInput {
  characterId?: string;
  persona: PersonaDraft | ReferencePromptInput;
  count?: number; // default: 4 (antara 3 dan 5)
  artStyle?: string;
  registry?: MediaProviderRegistry;
  provider?: ImageProvider;
}

export interface ReferenceGeneratorResult {
  characterId?: string;
  referenceImages: string[];
  promptsUsed: GeneratedPromptSpec[];
  providerUsed: string;
  attempts: string[];
  totalCost: number;
}

export class ReferenceGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceGeneratorError';
  }
}

/**
 * Buat 3-5 prompt gambar referensi berbasis deskripsi visual persona karakter.
 */
export function buildReferencePrompts(
  input: ReferencePromptInput,
  count = 4,
): GeneratedPromptSpec[] {
  const targetCount = Math.max(3, Math.min(5, count));
  const selectedAngles = DEFAULT_REFERENCE_ANGLES.slice(0, targetCount);

  if (targetCount === 5) {
    selectedAngles.push({
      angle: 'back-detail',
      description: 'Tampak belakang 3/4, detail bagian belakang outfit/rambut/ekor',
      cameraPrompt: 'three-quarter back view shot, detailed rear design and outfit elements',
    });
  }

  const traits = input.coreTraits && input.coreTraits.length > 0
    ? `Personality traits: ${input.coreTraits.join(', ')}.`
    : '';
  const style = input.artStyle || '2D digital character illustration, vibrant colors, clean lines, character turnaround reference sheet';

  return selectedAngles.map((spec) => {
    const prompt = `Character reference sheet for ${input.displayName}, a ${input.species} (${input.ageDescriptor}). Visual appearance: ${input.visualDescription}. ${traits} Shot type: ${spec.cameraPrompt}. Art style: ${style}. Pure white background, high quality, consistent character design.`;
    return {
      angle: spec.angle,
      prompt,
      description: spec.description,
    };
  });
}

/**
 * Generate 3-5 reference image untuk karakter berbasis persona draft atau data karakter.
 */
export async function generateCharacterReferenceImages(
  input: ReferenceGeneratorInput,
): Promise<ReferenceGeneratorResult> {
  const personaInput: ReferencePromptInput = {
    displayName: input.persona.displayName,
    species: input.persona.species,
    ageDescriptor: input.persona.ageDescriptor,
    visualDescription: input.persona.visualDescription,
    coreTraits: input.persona.coreTraits,
    artStyle: input.artStyle,
  };

  if (!personaInput.visualDescription || personaInput.visualDescription.trim() === '') {
    throw new ReferenceGeneratorError('Deskripsi visual (visualDescription) tidak boleh kosong untuk generate reference image.');
  }

  const count = input.count ?? 4;
  const promptSpecs = buildReferencePrompts(personaInput, count);

  let registry = input.registry;
  if (!registry) {
    registry = new MediaProviderRegistry();
    if (input.provider) {
      registry.registerImageProvider(input.provider);
      registry.setImageChain([input.provider.name]);
    } else {
      // Default fallback mock provider jika tidak disuplai
      const mockProvider = new MockImageProvider('flux-2-pro');
      registry.registerImageProvider(mockProvider);
      registry.setImageChain(['flux-2-pro']);
    }
  }

  const referenceImages: string[] = [];
  const allAttempts: string[] = [];
  let lastProviderUsed = '';
  let totalCost = 0;

  for (const spec of promptSpecs) {
    const { result, providerUsed, attempts } = await registry.generateImage({
      prompt: spec.prompt,
    });

    referenceImages.push(result.url);
    lastProviderUsed = providerUsed;
    totalCost += result.cost ?? 0;
    attempts.forEach((a) => {
      if (!allAttempts.includes(a)) allAttempts.push(a);
    });
  }

  return {
    characterId: input.characterId,
    referenceImages,
    promptsUsed: promptSpecs,
    providerUsed: lastProviderUsed,
    attempts: allAttempts,
    totalCost: Math.round(totalCost * 10000) / 10000,
  };
}
