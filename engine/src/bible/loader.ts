import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { BibleFile } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root universe-bible/ dihitung relatif dari lokasi file ini,
 * supaya loader tetap benar dijalankan dari mana pun (pnpm workspace, CI, dll).
 * engine/src/bible/loader.ts -> ../../../universe-bible
 */
const BIBLE_ROOT = path.resolve(__dirname, "../../../universe-bible");

/**
 * Whitelist path bible yang boleh dipakai engine.
 * Sengaja eksplisit (bukan scan seluruh folder otomatis) supaya:
 * 1. Jelas file mana yang benar-benar dipakai di setiap generation
 * 2. Kalau ada file baru di universe-bible, engine TIDAK otomatis "menelan"
 *    isinya tanpa sepengetahuan siapa pun yang maintain kode ini
 */
export const BIBLE_PATHS = {
  characterOverview: "01-character-bible/00-overview.md",
  suro: "01-character-bible/01-suro.md",
  buya: "01-character-bible/02-buya.md",
  relationshipDynamic: "01-character-bible/03-relationship-dynamic.md",
  voiceGuide: "01-character-bible/04-voice-guide.md",
  canonRules: "02-world-bible/03-canon-rules.md",
  geographySetting: "02-world-bible/01-geography-setting.md",
  regionalCultureGuide: "02-world-bible/04-regional-culture-guide.md",
  episodeFormula: "03-story-bible/02-episode-formula.md",
} as const;

export type BibleKey = keyof typeof BIBLE_PATHS;

const cache = new Map<string, BibleFile>();

/**
 * Baca satu file bible berdasarkan key. Hasil di-cache in-memory
 * per proses (CLI ini short-lived, jadi cache sederhana cukup).
 */
export async function loadBibleFile(key: BibleKey): Promise<BibleFile> {
  const relPath = BIBLE_PATHS[key];
  if (cache.has(relPath)) {
    return cache.get(relPath)!;
  }

  const fullPath = path.join(BIBLE_ROOT, relPath);
  let content: string;
  try {
    content = await readFile(fullPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Gagal membaca bible file "${relPath}" di ${fullPath}. ` +
        `Pastikan universe-bible/ ada di root repo dan path-nya belum berubah. ` +
        `Original error: ${(err as Error).message}`
    );
  }

  const file: BibleFile = { relPath, content };
  cache.set(relPath, file);
  return file;
}

export async function loadBibleFiles(keys: BibleKey[]): Promise<BibleFile[]> {
  return Promise.all(keys.map(loadBibleFile));
}
