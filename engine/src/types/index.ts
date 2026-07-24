/**
 * Tipe-tipe inti untuk engine.
 * Sengaja minimal — ditambah seiring kebutuhan nyata muncul,
 * bukan didesain habis-habisan di muka sebelum ada use case.
 */

export type CharacterId = "suro" | "buya";

export interface BibleFile {
  /** Path relatif dari root universe-bible/, mis. "01-character-bible/01-suro.md" */
  relPath: string;
  /** Isi mentah file markdown */
  content: string;
}

export interface SceneRequest {
  /** Karakter yang wajib muncul di scene ini */
  characters: CharacterId[];
  /** Daerah/setting scene, mis. "Surabaya", "Bali" — bebas teks, dicocokkan manual dulu ke regional guide kalau ada */
  region?: string;
  /** Instruksi singkat tentang apa yang terjadi di scene ini */
  premise: string;
  /** Target jumlah baris dialog kira-kira, default 8-12 */
  targetLines?: number;
}

export interface GeneratedScene {
  request: SceneRequest;
  /** Output mentah dari model */
  rawText: string;
  /** Hasil pengecekan canon */
  validation: ValidationResult;
  /** Metadata generation */
  meta: {
    model: string;
    generatedAt: string;
  };
}

export interface ValidationIssue {
  severity: "error" | "warning";
  rule: string;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}
