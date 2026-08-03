/**
 * Suro-Buya Engine v2 - Content Guideline Check (VF-2.3)
 *
 * Cek apakah naskah video konsisten dengan `ContentRating` dan
 * `audienceProfile` yang dideklarasikan oleh universe pemanggil.
 *
 * PENTING — soal prinsip desain (lihat REDESIGN-VIDEO-FACTORY.md §2.3.1):
 * Modul ini GENERIK — tidak hardcode child-safety. Setiap universe
 * menentukan `ContentRating`-nya sendiri (ALL_AGES, TEEN, MATURE), dan
 * modul ini membandingkan naskah terhadap rating yang DIPILIH creator,
 * bukan asumsi audiens default di level engine.
 *
 * Hasil check HARUS BERBEDA untuk rating berbeda — ini acceptance
 * criteria eksplisit di IMPLEMENTATION-PLAN-VIDEO-FACTORY.md:
 * "naskah dengan tema intens lolos untuk universe MATURE, tapi di-flag
 * untuk universe ALL_AGES".
 *
 * Dua lapis check:
 * 1. Pattern-based (deterministik) — cek kata/frasa terlarang berdasarkan rating
 * 2. Heuristic intensity scoring — estimasi tingkat ketegangan/kekerasan/tema dewasa
 *
 * Catatan: LLM-based semantic check ada di safety-review.ts (VF-5.1),
 * BUKAN di sini. Modul ini cuma check deterministik ringan untuk feedback
 * cepat ke script-generator.ts (VF-2.2) sebelum naskah masuk pipeline
 * yang lebih mahal (canon check, visual generation, dll).
 */

import type { ContentRating } from '@suro-buya/shared';

/**
 * Input untuk content guideline check.
 */
export interface ContentGuidelineInput {
  /** Naskah yang akan dicek */
  script: string;

  /** Rating universe pemanggil — dari @suro-buya/shared (VF-2.0) */
  contentRating: ContentRating;

  /** Profil audiens bebas teks dari universe, mis. "keluarga Indonesia, tema edukatif" */
  audienceProfile?: string;
}

/**
 * Tipe warning yang dihasilkan.
 */
export interface ContentWarning {
  /** Kategori warning */
  type: 'theme-mismatch' | 'intensity-mismatch' | 'tone-mismatch' | 'language-mismatch';

  /** Pesan deskriptif */
  message: string;

  /** Lokasi di script (baris atau kutipan teks) */
  location?: string;

  /** Saran perbaikan */
  suggestion?: string;
}

/**
 * Hasil content guideline check.
 */
export interface ContentGuidelineResult {
  /** Apakah naskah lolos check (tidak ada violation, warning boleh) */
  passed: boolean;

  /** Warning yang ditemukan (tidak block, cuma informasi) */
  warnings: ContentWarning[];

  /** Violation yang ditemukan (block — harus diperbaiki) */
  violations: ContentWarning[];

  /** Severity keseluruhan */
  severity: 'ok' | 'warning' | 'violation';

  /** Ringkasan satu kalimat */
  summary: string;

  /** Rating yang dipakai untuk check */
  contentRating: ContentRating;
}

// ============================================================
// Pattern Database — GENERIK, bukan child-safety spesifik
// ============================================================

/**
 * Pola konten yang TIDAK BOLEH muncul di universe ALL_AGES.
 * Ini bukan asumsi "semua universe untuk anak" — ini rule khusus
 * untuk universe yang DIPILIH creator-nya sebagai ALL_AGES.
 */
const ALL_AGES_BLOCKED_PATTERNS: Array<{ pattern: RegExp; type: ContentWarning['type']; message: string; suggestion: string }> = [
  {
    pattern: /\b(kekerasan|pembunuhan|darah|penyiksaan|penganiayaan)\b/i,
    type: 'intensity-mismatch',
    message: 'Tema kekerasan eksplisit tidak cocok untuk universe ALL_AGES.',
    suggestion: 'Ganti dengan konflik non-fisik atau kurangi intensitas.',
  },
  {
    pattern: /\b(seks|seksual|persetubuhan|pornografi)\b/i,
    type: 'theme-mismatch',
    message: 'Konten seksual tidak diperbolehkan di universe ALL_AGES.',
    suggestion: 'Hapus referensi seksual sepenuhnya.',
  },
  {
    pattern: /\b(narkoba|narkotika|ganja|sabu|ekstasi|alkohol|mabuk)\b/i,
    type: 'theme-mismatch',
    message: 'Referensi substansi terlarang/alkohol tidak cocok untuk universe ALL_AGES.',
    suggestion: 'Hapus atau ganti dengan konteks edukatif yang jelas.',
  },
  {
    pattern: /\b(bangsat|goblok|anjing|babi|kontol|memek|fuck|shit|damn)\b/i,
    type: 'language-mismatch',
    message: 'Bahasa kasar/ekspresit tidak cocok untuk universe ALL_AGES.',
    suggestion: 'Ganti dengan bahasa yang lebih sopan.',
  },
  {
    pattern: /\b(suicide|bunuh diri|self-harm|melukai diri)\b/i,
    type: 'theme-mismatch',
    message: 'Tema self-harm/suicide tidak cocok untuk universe ALL_AGES tanpa konteks edukatif yang jelas.',
    suggestion: 'Hapus atau bingkai dengan pesan pencegahan yang jelas.',
  },
];

/**
 * Pola konten yang TIDAK BOLEH muncul di universe TEEN.
 * Lebih longgar dari ALL_AGES — kekerasan ringan boleh, tapi konten
 * dewasa eksplisit tetap dilarang.
 */
const TEEN_BLOCKED_PATTERNS: Array<{ pattern: RegExp; type: ContentWarning['type']; message: string; suggestion: string }> = [
  {
    pattern: /\b(seks|seksual|persetubuhan|pornografi)\b/i,
    type: 'theme-mismatch',
    message: 'Konten seksual eksplisit tidak diperbolehkan di universe TEEN.',
    suggestion: 'Kurangi ke eksplisit atau hilangkan sepenuhnya.',
  },
  {
    pattern: /\b(pembunuhan|penyiksaan|penganiayaan|gore)\b/i,
    type: 'intensity-mismatch',
    message: 'Kekerasan grafis/eksplisit tidak cocok untuk universe TEEN.',
    suggestion: 'Kurangi detail grafis, gunakan implied violence.',
  },
  {
    pattern: /\b(narkoba|narkotika|ganja|sabu|ekstasi)\b/i,
    type: 'theme-mismatch',
    message: 'Referensi narkoba tidak cocok untuk universe TEEN tanpa konteks edukatif.',
    suggestion: 'Tambahkan konteks edukatif atau hilangkan.',
  },
  {
    pattern: /\b(bangsat|kontol|memek|fuck)\b/i,
    type: 'language-mismatch',
    message: 'Bahasa sangat kasar tidak cocok untuk universe TEEN.',
    suggestion: 'Gunakan bahasa yang lebih moderat.',
  },
];

/**
 * Pola konten yang TIDAK BOLEH muncul di universe MATURE.
 * Paling longgar — tema intens, kekerasan, dan bahasa kasar BOLEH,
 * yang dilarang hanya konten ilegal universal (baseline platform policy).
 *
 * Catatan: baseline platform policy yang lebih lengkap (konten ilegal,
 * ujaran kebencian, konten seksual non-konsensual) ada di safety-review.ts
 * (VF-5.1). Modul ini cuma cek rating-consistency, bukan baseline policy.
 */
const MATURE_BLOCKED_PATTERNS: Array<{ pattern: RegExp; type: ContentWarning['type']; message: string; suggestion: string }> = [
  {
    pattern: /\b(pedofilia|paedofilia|child abuse|pelecehan anak)\b/i,
    type: 'theme-mismatch',
    message: 'Konten yang melibatkan eksploitasi anak dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus sepenuhnya — ini pelanggaran baseline policy, bukan cuma rating.',
  },
  {
    pattern: /\b(terrorisme|promosi terorisme|incit(e)?(ing)? violence)\b/i,
    type: 'theme-mismatch',
    message: 'Promosi terorisme/kekerasan nyata dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus atau bingkai dengan jelas sebagai anti-narasi.',
  },
];

/**
 * Peta rating → pola terlarang.
 */
const RATING_PATTERNS: Record<ContentRating, Array<{ pattern: RegExp; type: ContentWarning['type']; message: string; suggestion: string }>> = {
  ALL_AGES: ALL_AGES_BLOCKED_PATTERNS,
  TEEN: TEEN_BLOCKED_PATTERNS,
  MATURE: MATURE_BLOCKED_PATTERNS,
};

// ============================================================
// Intensity Scoring — estimasi tingkat ketegangan/tema
// ============================================================

/**
 * Kata/frasa yang mengindikasikan intensitas tinggi.
 * Dipakai untuk scoring heuristic — bukan block otomatis.
 */
const INTENSITY_INDICATORS = [
  /\b(mati|kematian|tewas|bunuh)\b/i,
  /\b(berdarah|luka|sakit)\b/i,
  /\b(takut|ketakutan|horor|menyeramkan)\b/i,
  /\b(amarah|marah|benci|dendam)\b/i,
  /\b(perang|pertarungan|adu)\b/i,
];

/**
 * Estimasi skor intensitas naskah (0-1).
 * 0 = sangat ringan/santai, 1 = sangat intens/gelap.
 */
function estimateIntensityScore(script: string): number {
  const scriptLower = script.toLowerCase();
  let matchCount = 0;

  for (const pattern of INTENSITY_INDICATORS) {
    const matches = scriptLower.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      matchCount += matches.length;
    }
  }

  // Normalisasi: 5+ match = skor maksimum (1.0)
  return Math.min(1, matchCount / 5);
}

/**
 * Threshold intensitas per rating.
 * Kalau skor intensitas naskah melebihi threshold rating, flag sebagai warning.
 */
const INTENSITY_THRESHOLDS: Record<ContentRating, number> = {
  ALL_AGES: 0.2, // sangat rendah — tema intens langsung di-flag
  TEEN: 0.5,    // moderat — tema moderat OK, tema sangat intens di-flag
  MATURE: 0.9,  // tinggi — cuma tema ekstrem yang di-flag
};

// ============================================================
// Main Check Function
// ============================================================

/**
 * Cek apakah naskah konsisten dengan `ContentRating` dan `audienceProfile`
 * universe pemanggil.
 *
 * Hasil BERBEDA untuk rating berbeda — ini by design:
 * - ALL_AGES: paling ketat (banyak pattern dilarang, threshold intensitas rendah)
 * - TEEN: moderat (beberapa pattern dilarang, threshold menengah)
 * - MATURE: paling longgar (hanya konten ilegal yang dilarang, threshold tinggi)
 *
 * @param input Naskah + rating + audience profile
 * @returns Hasil check dengan warnings dan violations
 */
export function checkContentGuidelines(input: ContentGuidelineInput): ContentGuidelineResult {
  const { script, contentRating, audienceProfile } = input;

  const warnings: ContentWarning[] = [];
  const violations: ContentWarning[] = [];

  // 1. Pattern-based check — cek pola terlarang berdasarkan rating
  const patterns = RATING_PATTERNS[contentRating];
  for (const { pattern, type, message, suggestion } of patterns) {
    const matches = script.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      // Cari lokasi (kutipan teks di sekitar match)
      const matchIndex = script.search(pattern);
      const location = matchIndex >= 0
        ? script.substring(
            Math.max(0, matchIndex - 20),
            Math.min(script.length, matchIndex + pattern.source.length + 20),
          ).trim()
        : undefined;

      const warning: ContentWarning = {
        type,
        message,
        location: location ? `"…${location}…"` : undefined,
        suggestion,
      };

      // ALL_AGES: pattern match = violation (block)
      // TEEN: pattern match = violation (block)
      // MATURE: hanya baseline policy patterns yang jadi violation
      // (MATURE_BLOCKED_PATTERNS sudah cuma berisi baseline policy)
      violations.push(warning);
    }
  }

  // 2. Intensity scoring — cek apakah intensitas naskah melebihi threshold rating
  const intensityScore = estimateIntensityScore(script);
  const intensityThreshold = INTENSITY_THRESHOLDS[contentRating];

  if (intensityScore > intensityThreshold) {
    const intensityWarning: ContentWarning = {
      type: 'intensity-mismatch',
      message: `Tingkat intensitas naskah (${(intensityScore * 100).toFixed(0)}%) melebihi batas untuk rating ${contentRating} (${(intensityThreshold * 100).toFixed(0)}%).`,
      suggestion: contentRating === 'ALL_AGES'
        ? 'Kurangi tema ketegangan/kekerasan, ganti dengan konflik yang lebih ringan.'
        : contentRating === 'TEEN'
          ? 'Kurangi detail grafis, gunakan implied violence atau tension.'
          : 'Pertimbangkan apakah intensitas ini benar-benar diperlukan untuk cerita.',
    };

    // Intensity warning = warning (tidak block), bukan violation
    warnings.push(intensityWarning);
  }

  // 3. Audience profile check — kalau audience profile menyebutkan
  // preferensi spesifik, cek konsistensi dasar
  if (audienceProfile) {
    const profileLower = audienceProfile.toLowerCase();

    // Kalau profile menyebut "edukatif" atau "anak", cek apakah
    // naskah punya elemen edukatif
    if (profileLower.includes('edukatif') || profileLower.includes('anak')) {
      const hasEducationalElement = /\b(pelajaran|belajar|tahu|paham|rahasia|pengetahuan|edukasi)\b/i.test(script);
      if (!hasEducationalElement && contentRating === 'ALL_AGES') {
        warnings.push({
          type: 'tone-mismatch',
          message: 'Audience profile menyebutkan "edukatif/anak" tapi naskah tidak terlihat memiliki elemen edukatif yang jelas.',
          suggestion: 'Pertimbangkan menambahkan elemen pembelajaran atau pesan moral yang lebih jelas.',
        });
      }
    }
  }

  // Determine overall severity
  let severity: ContentGuidelineResult['severity'] = 'ok';
  if (violations.length > 0) {
    severity = 'violation';
  } else if (warnings.length > 0) {
    severity = 'warning';
  }

  // Summary
  const summary = violations.length > 0
    ? `${violations.length} violation ditemukan untuk rating ${contentRating}.`
    : warnings.length > 0
      ? `${warnings.length} warning untuk rating ${contentRating}. Naskah lolos tapi perlu perhatian.`
      : `Naskah lolos check untuk rating ${contentRating}.`;

  return {
    passed: violations.length === 0,
    warnings,
    violations,
    severity,
    summary,
    contentRating,
  };
}