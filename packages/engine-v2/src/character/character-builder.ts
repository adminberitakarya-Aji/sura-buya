/**
 * Suro-Buya Engine v2 - Character Builder (VF-1.5)
 *
 * Mengubah `PersonaDraft` yang SUDAH disetujui user di Step 2 wizard menjadi
 * shape yang siap disimpan sebagai `Character` (Bible) + `CharacterAsset`
 * permanen — bukan bikin tabel/model baru, reuse struktur Prisma existing.
 *
 * PENTING — soal arsitektur: modul ini SENGAJA tidak menyentuh Prisma sama
 * sekali, murni fungsi transformasi data. Ini konsisten dengan pola yang
 * sudah ada di seluruh `engine-v2` (lihat `apps/web/src/lib/engine/db-context.ts`
 * yang jadi "jembatan" antara engine-v2 dan Postgres) — engine-v2 tidak
 * pernah punya akses database langsung, semua write ke Postgres terjadi di
 * `apps/web`. Penulisan Prisma nyata (create Character + CharacterAsset,
 * termasuk penanganan error unique constraint kalau nama karakter bentrok)
 * ada di bridge layer `apps/web/src/lib/engine/character-persistence.ts` —
 * lihat PATCH-INSTRUCTIONS.md untuk contoh lengkapnya.
 */

import type { CharacterRole, PersonaDraft } from '@suro-buya/shared';
import { validatePersonaDraft } from './persona-parser.js';

/**
 * Shape yang cocok 1:1 dengan field model Prisma `Character` existing
 * (lihat apps/web/prisma/schema.prisma) — TIDAK menyertakan `id`,
 * `universeId`, `order`, `createdAt`, `updatedAt` karena itu ranah Prisma
 * layer (default value / di-set oleh bridge saat create).
 */
export interface CharacterCreateInput {
  /** Slug internal, mis. "kiko" — HARUS unik per universe (ditegakkan lewat @@unique([universeId, characterId]) di Prisma, bukan di sini) */
  characterId: string;
  name: string;
  role: CharacterRole;
  displayName: string;
  description: string;
  coreTraits: string[];
  coreWeakness: string;
  voiceGuide: string;
  /**
   * Field PersonaDraft yang TIDAK punya kolom Prisma langsung (species,
   * ageDescriptor, motivation, visualDescription) disimpan di sini —
   * `Character.metadata` sudah bertipe Json di schema existing, jadi tidak
   * perlu migration tambahan. `visualDescription` di dalamnya dikonsumsi
   * ulang oleh `reference-generator.ts` (VF-1.6).
   */
  metadata: {
    species: string;
    ageDescriptor: string;
    motivation: string | null;
    visualDescription: string;
    /** 'ai-parsed' | 'manual' — dipertahankan untuk audit/analytics, TIDAK memengaruhi logika apapun setelah tersimpan */
    personaSource: PersonaDraft['source'];
  };
}

/**
 * Shape awal `CharacterAsset` — dibuat KOSONG (belum ada reference image)
 * bersamaan dengan `Character`-nya. `reference-generator.ts` (VF-1.6)
 * yang mengisi `referenceImages` lewat UPDATE terpisah setelah user approve
 * hasil generate di Step 3 wizard.
 */
export interface CharacterAssetCreateInput {
  referenceImages: string[];
  voiceProfile: Record<string, unknown> | null;
}

/**
 * Error yang dilempar kalau draft yang masuk ke sini ternyata tidak valid.
 * SEHARUSNYA tidak pernah terjadi kalau caller sudah lewat Step 2 (review)
 * dengan benar — kalau sampai terjadi, itu tanda ada bug di alur UI/API
 * yang meloloskan draft belum-approved ke sini.
 */
export class CharacterBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterBuildError';
  }
}

/**
 * Petakan PersonaDraft final (hasil Step 2, baik dari AI yang sudah dikoreksi
 * maupun form manual) ke input siap-create untuk model `Character` existing.
 *
 * Melakukan validasi ulang lewat `validatePersonaDraft` (defense in depth —
 * caller SEHARUSNYA sudah validasi di titik lain, tapi fungsi murni seperti
 * ini tidak boleh assume input selalu bersih).
 */
export function buildCharacterCreateInput(draft: PersonaDraft): CharacterCreateInput {
  let validated: PersonaDraft;
  try {
    validated = validatePersonaDraft(draft);
  } catch (err) {
    throw new CharacterBuildError(
      `Draft tidak valid untuk dijadikan Character permanen: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    characterId: validated.name,
    name: validated.displayName,
    role: validated.role,
    displayName: validated.displayName,
    description: validated.description,
    coreTraits: validated.coreTraits,
    coreWeakness: validated.coreWeakness,
    voiceGuide: validated.voiceGuide,
    metadata: {
      species: validated.species,
      ageDescriptor: validated.ageDescriptor,
      motivation: validated.motivation ?? null,
      visualDescription: validated.visualDescription,
      personaSource: validated.source,
    },
  };
}

/** CharacterAsset awal — selalu kosong saat dibuat, diisi belakangan di VF-1.6 */
export function buildCharacterAssetCreateInput(): CharacterAssetCreateInput {
  return {
    referenceImages: [],
    voiceProfile: null,
  };
}