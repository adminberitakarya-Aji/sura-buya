import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import {
  generateCharacterReferenceImages,
  MediaProviderRegistry,
  MockImageProvider,
} from '@suro-buya/engine-v2';
import type { ImageProvider } from '@suro-buya/engine-v2';

const generateRefBodySchema = z.object({
  /**
   * Jumlah gambar referensi yang akan di-generate. Minimum 3, maksimum 5.
   * Default: 4 (Front Portrait, Side Profile, Full Body, Action Expression).
   */
  count: z.number().int().min(3).max(5).default(4),
  /**
   * Gaya visual (art style) untuk prompt. Default: 2D digital character
   * illustration sesuai target produksi Suro & Buya.
   */
  artStyle: z
    .string()
    .max(500)
    .optional()
    .default('2D digital character illustration, vibrant colors, clean lines, turnaround reference sheet'),
  /**
   * Simpan hasil generate ke `CharacterAsset.referenceImages` secara otomatis
   * setelah berhasil. Default: true.
   */
  saveToAsset: z.boolean().default(true),
});

interface RouteParams {
  params: { universeId: string; characterId: string };
}

/**
 * POST /api/universes/:universeId/characters/:characterId/asset/reference-generate
 *
 * Step 3 wizard — trigger generate 3-5 turnaround reference images untuk
 * karakter yang sudah disimpan ke Character Bible.
 *
 * Alur:
 *  1. Ambil Character + metadata (visualDescription ada di Character.metadata)
 *  2. Ambil AI config universe untuk image provider (jika ada)
 *  3. Jalankan `generateCharacterReferenceImages()` via VF-1.6 reference-generator
 *  4. Jika `saveToAsset=true`, upsert CharacterAsset.referenceImages ke DB
 *  5. Kembalikan hasil + URL gambar ke client
 *
 * PENTING: Pada MVP ini, jika tidak ada image provider nyata yang terkonfigurasi,
 * endpoint mengembalikan "placeholder" URL dari mock provider yang menandakan
 * gambar siap di-generate (client lalu menampilkan UI yang sesuai). Integrasi
 * Kling/Flux nyata ada di VF-3.1.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    // Ambil karakter + metadata persona
    const character = await prisma.character.findFirstOrThrow({
      where: { id: params.characterId, universeId: params.universeId },
      select: {
        id: true,
        characterId: true,
        displayName: true,
        coreTraits: true,
        metadata: true,
      },
    });

    const metadata = character.metadata as {
      species?: string;
      ageDescriptor?: string;
      visualDescription?: string;
    } | null;

    if (!metadata?.visualDescription || metadata.visualDescription.trim() === '') {
      return NextResponse.json(
        {
          error:
            'Karakter belum memiliki deskripsi visual (visualDescription). Perbarui metadata karakter sebelum generate reference image.',
        },
        { status: 422 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { count, artStyle, saveToAsset } = generateRefBodySchema.parse(body);

    // Bangun registry provider — VF-3.1 akan mengganti mock dengan Flux/Kling nyata.
    // Pada MVP: cek apakah ada image provider config di universe, jika tidak gunakan mock.
    const registry = new MediaProviderRegistry();
    const imageProvider = await resolveImageProvider(params.universeId);
    registry.registerImageProvider(imageProvider);
    registry.setImageChain([imageProvider.name]);

    // Jalankan VF-1.6 reference generator
    const result = await generateCharacterReferenceImages({
      characterId: character.characterId,
      persona: {
        displayName: character.displayName,
        species: metadata.species ?? 'Karakter',
        ageDescriptor: metadata.ageDescriptor ?? 'dewasa muda',
        visualDescription: metadata.visualDescription,
        coreTraits: character.coreTraits,
      },
      count,
      artStyle,
      registry,
    });

    // Simpan ke CharacterAsset.referenceImages jika diminta
    if (saveToAsset && result.referenceImages.length > 0) {
      await prisma.characterAsset.upsert({
        where: { characterId: character.id },
        create: {
          characterId: character.id,
          referenceImages: result.referenceImages,
        },
        update: {
          referenceImages: result.referenceImages,
        },
      });
    }

    return NextResponse.json(
      {
        result: {
          characterId: character.characterId,
          referenceImages: result.referenceImages,
          promptsUsed: result.promptsUsed,
          providerUsed: result.providerUsed,
          totalCost: result.totalCost,
        },
        savedToAsset: saveToAsset && result.referenceImages.length > 0,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// Helper — resolve image provider untuk universe tertentu.
// VF-3.1 akan mengisi ini dengan Flux / Kling / Seedance nyata.
// Pada MVP, selalu gunakan mock provider jika belum ada konfigurasi.
// ---------------------------------------------------------------------------

async function resolveImageProvider(universeId: string): Promise<ImageProvider> {
  // Pada VF-3.1, kita akan:
  // 1. Cek AIConfig universe untuk task IMAGE_GENERATION
  // 2. Build FluxImageProvider / KlingImageProvider sesuai config
  // 3. Return provider nyata
  //
  // Untuk sekarang (VF-1.8 MVP), gunakan mock yang mengembalikan
  // placeholder URL dengan nama gambar yang informatif.
  void universeId; // akan dipakai di VF-3.1

  return new MockImageProvider('flux-2-pro-mock');
}
