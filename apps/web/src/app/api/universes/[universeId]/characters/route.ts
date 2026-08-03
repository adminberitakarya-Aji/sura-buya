import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { CharacterCreateInput } from '@suro-buya/engine-v2';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import {
  persistCharacter,
  CharacterAlreadyExistsError,
} from '@/lib/engine/character-persistence';

const characterRoleEnum = z.enum([
  'PROTAGONIST',
  'DEUTERAGONIST',
  'SUPPORTING',
  'ANTAGONIST',
  'NARRATOR',
]);

const createCharacterSchema = z.object({
  characterId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'characterId must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  role: characterRoleEnum,
  displayName: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  coreTraits: z.array(z.string()).default([]),
  coreWeakness: z.string().min(1).max(500),
  voiceGuide: z.string().max(8000).optional(),
  bibleRef: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  order: z.number().int().default(0),
});

interface RouteParams {
  params: { universeId: string };
}

/** GET /api/universes/:universeId/characters */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');
    const characters = await prisma.character.findMany({
      where: { universeId: params.universeId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Petakan body route CRUD form-based (createCharacterSchema) ke
 * CharacterCreateInput engine-v2. Route lama membolehkan metadata bebas;
 * kita tahan field persona opsional dengan default kosong demi no-regression,
 * sementara bibleRef/order diteruskan via extra ke bridge agar tersimpan.
 */
function toCharacterCreateInput(data: z.infer<typeof createCharacterSchema>): CharacterCreateInput {
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  return {
    characterId: data.characterId,
    name: data.name,
    role: data.role,
    displayName: data.displayName,
    description: data.description ?? data.name,
    coreTraits: data.coreTraits,
    coreWeakness: data.coreWeakness,
    voiceGuide: data.voiceGuide ?? '',
    metadata: {
      species: typeof metadata.species === 'string' ? metadata.species : '',
      ageDescriptor: typeof metadata.ageDescriptor === 'string' ? metadata.ageDescriptor : '',
      motivation: typeof metadata.motivation === 'string' ? metadata.motivation : null,
      visualDescription:
        typeof metadata.visualDescription === 'string' ? metadata.visualDescription : '',
      personaSource: metadata.personaSource === 'manual' ? 'manual' : 'ai-parsed',
    },
  };
}

/** POST /api/universes/:universeId/characters */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = createCharacterSchema.parse(body);

    // Persist ATOMIK: Character + CharacterAsset (referenceImages kosong)
    // dalam satu transaksi via bridge. CharacterAsset dibuat KOSONG duluan;
    // reference-generator (VF-1.6) mengisinya lewat PUT /asset.
    const character = await persistCharacter(
      params.universeId,
      toCharacterCreateInput(data),
      { referenceImages: [], voiceProfile: null },
      { bibleRef: data.bibleRef, order: data.order }
    );

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    if (error instanceof CharacterAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error);
  }
}