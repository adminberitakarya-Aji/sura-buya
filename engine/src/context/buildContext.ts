import { loadBibleFiles, type BibleKey } from "../bible/loader.js";
import type { SceneRequest } from "../types/index.js";

/**
 * Menentukan bible file mana saja yang relevan untuk sebuah SceneRequest.
 * Ini logika paling sederhana yang mungkin (character -> file karakter,
 * selalu sertakan canon rules & voice guide). Kalau nanti scene request
 * makin kompleks (butuh regional guide spesifik, dsb), tambahkan di sini
 * secara eksplisit — jangan diam-diam auto-include semua file.
 */
function selectBibleKeys(request: SceneRequest): BibleKey[] {
  const keys = new Set<BibleKey>([
    "characterOverview",
    "canonRules",
    "voiceGuide",
    "relationshipDynamic",
    "episodeFormula",
  ]);

  if (request.characters.includes("suro")) keys.add("suro");
  if (request.characters.includes("buya")) keys.add("buya");

  if (request.region) {
    keys.add("geographySetting");
    keys.add("regionalCultureGuide");
  }

  return Array.from(keys);
}

/**
 * Membangun context string (dipakai sebagai bagian dari system prompt)
 * dari potongan-potongan bible yang relevan untuk request ini.
 */
export async function buildContext(request: SceneRequest): Promise<string> {
  const keys = selectBibleKeys(request);
  const files = await loadBibleFiles(keys);

  const sections = files.map(
    (f) => `<!-- SOURCE: ${f.relPath} -->\n${f.content.trim()}`
  );

  return sections.join("\n\n---\n\n");
}

/** Untuk debugging: tahu file apa saja yang akan dipakai tanpa benar-benar generate. */
export function explainContext(request: SceneRequest): BibleKey[] {
  return selectBibleKeys(request);
}
