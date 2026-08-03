/**
 * Suro-Buya Engine v2 - Beat Sheet (VF-2.3)
 *
 * Struktur cerita untuk video pendek 15/30/60 detik. Setiap durasi punya
 * template beat yang berbeda — semakin panjang durasi, semakin banyak beat
 * yang bisa dimuat (Hook, Setup, Conflict, Climax, Resolution, dll).
 *
 * Beat sheet ini dipakai oleh:
 * - script-generator.ts (VF-2.2) sebagai struktur dasar saat generate naskah
 * - scene-breakdown.ts (VF-2.5) sebagai panduan saat membagi naskah jadi shot
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan character-builder.ts (VF-1.5).
 */

/**
 * Target durasi video pendek dalam detik. Sengaja dibatasi ke 3 pilihan
 * karena setiap durasi punya struktur beat yang berbeda — bukan rentang
 * kontinu yang bisa di-scale bebas.
 */
export type VideoDuration = 15 | 30 | 60;

/**
 * Satu beat dalam struktur cerita.
 */
export interface Beat {
  /** Index urutan beat (0-based) */
  index: number;

  /** Label singkat, mis. "Hook", "Setup", "Climax" */
  label: string;

  /** Durasi alokasi untuk beat ini dalam detik */
  durationSeconds: number;

  /** Deskripsi apa yang harus terjadi di beat ini */
  description: string;

  /** Tipe beat — dipakai scene-breakdown.ts untuk tentukan shot count */
  type: 'hook' | 'setup' | 'conflict' | 'rising-action' | 'climax' | 'falling-action' | 'resolution' | 'punchline';
}

/**
 * Beat sheet lengkap untuk satu durasi video.
 */
export interface BeatSheet {
  /** Durasi target video */
  duration: VideoDuration;

  /** Daftar beat dalam urutan kronologis */
  beats: Beat[];

  /** Total beat */
  totalBeats: number;

  /** Total durasi (harus sama dengan `duration`) */
  totalDuration: number;
}

/**
 * Template beat untuk video 15 detik — 3 beat.
 * Cocok untuk joke/punchline singkat, tips cepat, atau teaser.
 */
const BEAT_TEMPLATE_15: Omit<Beat, 'index'>[] = [
  {
    label: 'Hook',
    durationSeconds: 4,
    description: 'Tangkap perhatian penonton di 3 detik pertama. Tunjukkan karakter atau premis utama dengan visual yang menarik.',
    type: 'hook',
  },
  {
    label: 'Conflict',
    durationSeconds: 7,
    description: 'Konflik atau situasi yang harus diatasi karakter. Bangun ketegangan atau rasa ingin tahu.',
    type: 'conflict',
  },
  {
    label: 'Punchline',
    durationSeconds: 4,
    description: 'Resolusi singkat — punchline, twist, atau pesan moral. Biarkan penonton dengan kesan kuat.',
    type: 'punchline',
  },
];

/**
 * Template beat untuk video 30 detik — 5 beat.
 * Cocok untuk cerita mini dengan setup dan resolusi yang lebih matang.
 */
const BEAT_TEMPLATE_30: Omit<Beat, 'index'>[] = [
  {
    label: 'Hook',
    durationSeconds: 5,
    description: 'Tangkap perhatian penonton. Tunjukkan karakter utama dan situasi awal.',
    type: 'hook',
  },
  {
    label: 'Setup',
    durationSeconds: 6,
    description: 'Bangun konteks — siapa karakter, di mana, apa yang ingin dia capai.',
    type: 'setup',
  },
  {
    label: 'Conflict',
    durationSeconds: 8,
    description: 'Konflik utama muncul. Karakter menghadapi hambatan atau tantangan.',
    type: 'conflict',
  },
  {
    label: 'Climax',
    durationSeconds: 6,
    description: 'Puncak ketegangan. Karakter mengatasi konflik (atau gagal).',
    type: 'climax',
  },
  {
    label: 'Resolution',
    durationSeconds: 5,
    description: 'Resolusi — hasil dari konflik, pesan moral, atau setup untuk episode berikutnya (kalau series).',
    type: 'resolution',
  },
];

/**
 * Template beat untuk video 60 detik — 7 beat.
 * Cocok untuk cerita lengkap dengan arc karakter yang lebih dalam.
 */
const BEAT_TEMPLATE_60: Omit<Beat, 'index'>[] = [
  {
    label: 'Hook',
    durationSeconds: 6,
    description: 'Tangkap perhatian penonton. Tunjukkan karakter utama dan premis cerita.',
    type: 'hook',
  },
  {
    label: 'Setup',
    durationSeconds: 8,
    description: 'Bangun dunia dan konteks — siapa karakter, di mana, apa motivasinya.',
    type: 'setup',
  },
  {
    label: 'Inciting Incident',
    durationSeconds: 8,
    description: 'Peristiwa yang memicu konflik. Sesuatu mengubah situasi karakter.',
    type: 'conflict',
  },
  {
    label: 'Rising Action',
    durationSeconds: 12,
    description: 'Eskalasi konflik. Karakter berusaha mengatasi tapi menghadapi hambatan berturut-turut.',
    type: 'rising-action',
  },
  {
    label: 'Climax',
    durationSeconds: 10,
    description: 'Puncak ketegangan. Momok keputusan atau aksi terbesar karakter.',
    type: 'climax',
  },
  {
    label: 'Falling Action',
    durationSeconds: 8,
    description: 'Konsekuensi dari climax. Karakter menghadapi hasil dari keputusannya.',
    type: 'falling-action',
  },
  {
    label: 'Resolution',
    durationSeconds: 8,
    description: 'Resolusi — karakter berubah atau belajar sesuatu. Setup untuk episode berikutnya kalau series.',
    type: 'resolution',
  },
];

/**
 * Peta durasi → template beat.
 */
const BEAT_TEMPLATES: Record<VideoDuration, Omit<Beat, 'index'>[]> = {
  15: BEAT_TEMPLATE_15,
  30: BEAT_TEMPLATE_30,
  60: BEAT_TEMPLATE_60,
};

/**
 * Generate beat sheet untuk durasi tertentu.
 *
 * @param duration Target durasi video (15, 30, atau 60 detik)
 * @returns Beat sheet dengan beat yang sudah di-index
 */
export function generateBeatSheet(duration: VideoDuration): BeatSheet {
  const template = BEAT_TEMPLATES[duration];

  const beats: Beat[] = template.map((beat, index) => ({
    ...beat,
    index,
  }));

  const totalDuration = beats.reduce((sum, beat) => sum + beat.durationSeconds, 0);

  return {
    duration,
    beats,
    totalBeats: beats.length,
    totalDuration,
  };
}

/**
 * Hasil validasi script terhadap beat sheet.
 */
export interface BeatSheetValidationResult {
  /** Apakah script lolos validasi struktur */
  valid: boolean;

  /** Skor kepatuhan struktur (0-1) — seberapa banyak beat yang tercakup */
  structureScore: number;

  /** Warning untuk beat yang mungkin kurang tercakup */
  warnings: string[];

  /** Estimasi jumlah shot yang akan dihasilkan dari beat sheet ini */
  estimatedShotCount: number;
}

/**
 * Estimasi jumlah shot per beat berdasarkan durasi beat.
 * Aturan dasar: 1 shot per 3-5 detik beat.
 */
function estimateShotsForBeat(beat: Beat): number {
  if (beat.durationSeconds <= 4) return 1;
  if (beat.durationSeconds <= 8) return 2;
  return 3;
}

/**
 * Estimasi total shot count untuk beat sheet.
 */
export function estimateTotalShotCount(beatSheet: BeatSheet): number {
  return beatSheet.beats.reduce((sum, beat) => sum + estimateShotsForBeat(beat), 0);
}

/**
 * Validasi script terhadap beat sheet — cek apakah script cukup panjang
 * dan terstruktur untuk mencakup semua beat.
 *
 * Ini validasi ringan (heuristik berbasis panjang teks), bukan analisis
 * semantik — analisis semantik ada di canon check (VF-2.4).
 *
 * @param script Naskah yang sudah digenerate
 * @param beatSheet Beat sheet yang dipakai sebagai referensi
 * @returns Hasil validasi struktur
 */
export function validateScriptAgainstBeats(
  script: string,
  beatSheet: BeatSheet,
): BeatSheetValidationResult {
  const warnings: string[] = [];

  // Estimasi: 1 detik video ≈ 3-5 kata dialog/narasi
  const expectedWordCountMin = beatSheet.duration * 2; // ~2 kata/detik (minimum)
  const expectedWordCountMax = beatSheet.duration * 6; // ~6 kata/detik (maksimum)

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < expectedWordCountMin) {
    warnings.push(
      `Script terlalu pendek (${wordCount} kata) untuk durasi ${beatSheet.duration} detik. Minimal ~${expectedWordCountMin} kata yang diharapkan.`,
    );
  }

  if (wordCount > expectedWordCountMax) {
    warnings.push(
      `Script terlalu panjang (${wordCount} kata) untuk durasi ${beatSheet.duration} detik. Maksimum ~${expectedWordCountMax} kata yang diharapkan.`,
    );
  }

  // Cek apakah script punya struktur paragraf/section yang cukup
  const paragraphCount = script.split(/\n\s*\n/).filter(Boolean).length;
  if (paragraphCount < beatSheet.totalBeats) {
    warnings.push(
      `Script punya ${paragraphCount} paragraf, tapi beat sheet butuh ${beatSheet.totalBeats} beat. Pertimbangkan membagi script menjadi lebih banyak segmen.`,
    );
  }

  const estimatedShotCount = estimateTotalShotCount(beatSheet);

  // Skor struktur: berdasarkan apakah panjang script masuk akal dan paragraf cukup
  let structureScore = 1.0;
  if (warnings.length > 0) {
    structureScore -= warnings.length * 0.15;
  }
  structureScore = Math.max(0, Math.min(1, structureScore));

  return {
    valid: warnings.length === 0,
    structureScore,
    warnings,
    estimatedShotCount,
  };
}