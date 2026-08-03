import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const upsertCharacterAssetSchema = z.object({
  referenceImages: z.array(z.string().url('URL gambar harus valid')).optional(),
  voiceProfile: z
    .object({
      provider: z.string(),
      voiceId: z.string(),
      settings: z.record(z.unknown()).optional(),
    })
    .nullable()
    .optional(),
  loraConfig: z
    .object({
      loraPath: z.string(),
      strength: z.number().min(0).max(2).optional(),
    })
    .nullable()
    .optional(),
});

interface RouteParams {
  params: { universeId: string; characterId: string };
}

/**
 * GET /api/universes/:universeId/characters/:characterId/asset
 *
 * Mengambil `CharacterAsset` (lapisan visual/produksi) milik karakter.
 * Mengembalikan 404 jika belum ada (CharacterAsset bersifat opsional —
 * tidak semua karakter dipakai di video).
 *
 * `:characterId` di sini adalah `Character.id` (primary key CUID),
 * BUKAN `Character.characterId` (field slug).
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    // Pastikan karakter memang milik universe ini (mencegah akses cross-universe)
    const character = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
      select: { id: true, characterId: true, displayName: true },
    });

    const asset = await prisma.characterAsset.findUnique({
      where: { characterId: character.id },
    });

    if (!asset) {
      return NextResponse.json({ asset: null, character }, { status: 200 });
    }

    return NextResponse.json({ asset, character });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/universes/:universeId/characters/:characterId/asset
 *
 * Upsert `CharacterAsset` — membuat baru jika belum ada, atau memperbarui
 * yang sudah ada. Semantik PUT dipilih (bukan POST/PATCH) karena ini adalah
 * relasi 1:1 yang identitasnya ditentukan oleh `characterId`, bukan
 * primary key bebas.
 *
 * Dipakai oleh:
 *  - Step 3 wizard (simpan reference images setelah user approve generate)
 *  - Studio editor (update voice profile / lora config)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const character = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
      select: { id: true },
    });

    const body = await req.json();
    const data = upsertCharacterAssetSchema.parse(body);

    const asset = await prisma.characterAsset.upsert({
      where: { characterId: character.id },
      create: {
        characterId: character.id,
        referenceImages: data.referenceImages ?? [],
        voiceProfile: (data.voiceProfile as Prisma.InputJsonValue | null | undefined) ?? undefined,
        loraConfig: (data.loraConfig as Prisma.InputJsonValue | null | undefined) ?? undefined,
      },
      update: {
        ...(data.referenceImages !== undefined
          ? { referenceImages: data.referenceImages }
          : {}),
        ...(data.voiceProfile !== undefined
          ? {
              voiceProfile:
                data.voiceProfile === null
                  ? Prisma.JsonNull
                  : (data.voiceProfile as Prisma.InputJsonValue),
            }
          : {}),
        ...(data.loraConfig !== undefined
          ? {
              loraConfig:
                data.loraConfig === null
                  ? Prisma.JsonNull
                  : (data.loraConfig as Prisma.InputJsonValue),
            }
          : {}),
      },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/universes/:universeId/characters/:characterId/asset
 *
 * Hapus `CharacterAsset` (beserta semua reference images-nya).
 * Karakter (`Character`) itu sendiri TIDAK dihapus.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:delete');

    const character = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
      select: { id: true },
    });

    // Hapus asset jika ada; jika tidak ada tidak perlu error (idempoten)
    await prisma.characterAsset.deleteMany({
      where: { characterId: character.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
