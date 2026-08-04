import type { CharacterCreateInput, CharacterAssetCreateInput } from '@suro-buya/engine-v2';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Character Persistence Bridge (VF-1.5 / VF-1.8)
 * ===============================================
 * Jembatan antara `engine-v2` (murni fungsi transformasi, TIDAK menyentuh
 * Prisma) dan Postgres. Mengikuti pola `db-context.ts` existing: semua write
 * nyata ke database terjadi di `apps/web`, engine-v2 tidak pernah punya akses
 * DB langsung.
 *
 * Modul ini bertanggung jawab atas:
 *   - Persist ATOMIK `Character` + `CharacterAsset` dalam satu transaksi
 *     (karakter baru dari wizard VF-1.7 langsung punya lapisan 1:1 kosong).
 *   - CRUD `CharacterAsset` 1:1 untuk API `/characters/:id/asset`.
 *   - Penanganan error unique constraint (P2002) saat nama karakter bentrok.
 */

export class CharacterAlreadyExistsError extends Error {
  constructor(universeId: string, characterId: string) {
    super(`Karakter '${characterId}' sudah ada di universe ${universeId}`);
    this.name = 'CharacterAlreadyExistsError';
  }
}

/**
 * Konversi `voiceProfile` (Record<string, unknown> | null) ke tipe yang
 * diterima Prisma untuk kolom `Json?`. `undefined`/`null` → `null as any`.
 */
function toNullableJson(
  value: Record<string, unknown> | null | undefined
): any {
  if (value === null || value === undefined) return null as any;
  return value as unknown as any;
}

/**
 * Simpan `Character` + `CharacterAsset` secara ATOMIK dalam satu transaksi
 * lewat nested create — Prisma yang mengelola FK `CharacterAsset.characterId`
 * mengarah ke `Character.id` yang baru dibuat. Dipanggil dari
 * POST /universes/[universeId]/characters setelah draft persona di-approve
 * user di Step 2 wizard. Kalau `characterId` (slug) sudah dipakai di universe
 * yang sama, Prisma melempar P2002 — diterjemahkan jadi
 * `CharacterAlreadyExistsError` supaya route bisa balas 409.
 *
 * `extra` menampung field opsional dari route CRUD existing (`bibleRef`,
 * `order`) yang tidak ada di `CharacterCreateInput` engine-v2 — biar route
 * form-based lama tidak kehilangan fungsionalitas (no regression).
 */
export async function persistCharacter(
  universeId: string,
  input: CharacterCreateInput,
  assetInput: CharacterAssetCreateInput = { referenceImages: [], voiceProfile: null },
  extra: { bibleRef?: string | null; order?: number } = {}
) {
  try {
    return await prisma.character.create({
      data: {
        universeId,
        characterId: input.characterId,
        name: input.name,
        role: input.role,
        displayName: input.displayName,
        description: input.description,
        coreTraits: input.coreTraits,
        coreWeakness: input.coreWeakness,
        voiceGuide: input.voiceGuide,
        metadata: input.metadata,
        bibleRef: extra.bibleRef ?? null,
        order: extra.order ?? 0,
        // CharacterAsset dibuat KOSONG bersamaan dengan Character-nya;
        // reference-generator.ts (VF-1.6) mengisi referenceImages lewat UPDATE.
        characterAsset: {
          create: {
            referenceImages: assetInput.referenceImages,
            voiceProfile: toNullableJson(assetInput.voiceProfile),
          },
        },
      },
    });
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
      throw new CharacterAlreadyExistsError(universeId, input.characterId);
    }
    throw err;
  }
}

/**
 * Baca CharacterAsset 1:1 milik sebuah Character (dikey Character.id, BUKAN
 * characterId slug). Null kalau belum ada — caller (route GET) yang memutuskan.
 */
export async function getCharacterAsset(characterId: string) {
  return prisma.characterAsset.findUnique({ where: { characterId } });
}

/**
 * Upsert SEMANTIK CharacterAsset 1:1 — perbarui field yang diberikan tanpa
 * menimpa field lain. Dipakai PUT /characters/:id/asset (mis. simpan
 * referenceImages hasil generate Step 3).
 */
export async function upsertCharacterAsset(
  characterId: string,
  data: Partial<Pick<CharacterAssetCreateInput, 'referenceImages' | 'voiceProfile'>>
) {
  return prisma.characterAsset.upsert({
    where: { characterId },
    create: {
      characterId,
      referenceImages: data.referenceImages ?? [],
      voiceProfile: toNullableJson(data.voiceProfile),
    },
    update: {
      ...(data.referenceImages !== undefined ? { referenceImages: data.referenceImages } : {}),
      ...(data.voiceProfile !== undefined ? { voiceProfile: toNullableJson(data.voiceProfile) } : {}),
    },
  });
}

/**
 * Hapus CharacterAsset 1:1 (tidak menghapus Character-nya — relasi
 * onDelete: Cascade di Prisma hanya berlaku saat Character dihapus).
 */
export async function deleteCharacterAsset(characterId: string) {
  return prisma.characterAsset.delete({ where: { characterId } });
}