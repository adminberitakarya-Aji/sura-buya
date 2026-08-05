/**
 * Suro-Buya Engine v2 - Safety Review (VF-5.1)
 *
 * Content moderation dua lapis, GENERIK — tidak ada asumsi audiens
 * default di level engine (lihat REDESIGN-VIDEO-FACTORY.md §2.3.1).
 *
 * Lapis 1 — Baseline Platform Policy (deterministik, HARD-BLOCK):
 *   Rule engine untuk larangan universal yang berlaku ke SEMUA universe
 *   apapun rating-nya: konten ilegal, ujaran kebencian terhadap kelompok
 *   terlindungi, konten seksual non-konsensual, promosi kekerasan nyata.
 *   Ini standar trust & safety platform, BUKAN aturan khusus anak.
 *   Hasil: violation (block) — video TIDAK boleh di-export otomatis.
 *
 * Lapis 2 — Rating-Consistency Check (LLM classifier, WARNING):
 *   Membandingkan output video dengan `Universe.contentRating` /
 *   `audienceProfile` yang DIDEKLARASIKAN creator sendiri. Kalau
 *   universe dideklarasikan ALL_AGES tapi menghasilkan konten tidak cocok,
 *   di-flag sebagai WARNING untuk creator — BUKAN hard-block otomatis,
 *   karena rating itu keputusan creator, sistem cuma membantu konsistensi.
 *
 * PENTING — Acceptance criteria eksplisit (IMPLEMENTATION-PLAN-VIDEO-FACTORY.md §8):
 *   - Konten yang melanggar baseline policy diblokir di universe manapun
 *   - Video ALL_AGES yang tidak cocok rating-nya → warning, bukan hard-block
 *   - Video MATURE dengan tema intens TIDAK ikut ter-flag oleh aturan ALL_AGES
 *   - Dua universe rating berbeda diuji berdampingan untuk pastikan tidak
 *     ada satu aturan tunggal yang diam-diam mengasumsikan audiens anak
 *
 * Beda dari content-guideline-check.ts (VF-2.3):
 *   - content-guideline-check.ts = check ringan deterministik di tahap script
 *     (feedback cepat ke script-generator sebelum pipeline mahal)
 *   - safety-review.ts = check lengkap dua lapis di tahap final (sebelum export),
 *     termasuk LLM classifier untuk semantic analysis
 */

import type { ContentRating } from '@suro-buya/shared';
import type { AIProvider, AIProviderOptions } from '../ai/providers.js';

// ============================================================
// Types
// ============================================================

/**
 * Input untuk safety review.
 */
export interface SafetyReviewInput {
  /** Konten yang akan direview — bisa naskah, shot descriptions, atau metadata video final */
  content: string;

  /** Rating universe pemanggil — dari @suro-buya/shared */
  contentRating: ContentRating;

  /** Profil audiens bebas teks dari universe, mis. "keluarga Indonesia, tema edukatif" */
  audienceProfile?: string;

  /** Metadata tambahan tentang video (judul, shot descriptions, dll) — opsional */
  videoMetadata?: {
    title?: string;
    shotDescriptions?: string[];
    dialogueText?: string;
  };
}

/**
 * Lapis mana yang menemukan finding ini.
 */
export type SafetyLayer = 'baseline-policy' | 'rating-consistency';

/**
 * Severity finding.
 * - 'block': HARD-BLOCK — video tidak boleh di-export otomatis (baseline policy violation)
 * - 'warning': WARNING — creator tetap bisa export dengan kesadaran penuh (rating-consistency)
 * - 'info': INFO — catatan ringan, tidak mempengaruhi export
 */
export type SafetySeverity = 'block' | 'warning' | 'info';

/**
 * Kategori finding.
 */
export type SafetyCategory =
  | 'illegal-content'
  | 'hate-speech'
  | 'non-consensual-sexual-content'
  | 'violence-promotion'
  | 'rating-mismatch'
  | 'tone-mismatch'
  | 'intensity-mismatch'
  | 'theme-mismatch';

/**
 * Satu finding dari safety review.
 */
export interface SafetyFinding {
  /** Lapis mana yang menemukan ini */
  layer: SafetyLayer;

  /** Severity */
  severity: SafetySeverity;

  /** Kategori */
  category: SafetyCategory;

  /** ID rule yang trigger (untuk baseline policy) atau 'llm-classifier' (untuk rating-consistency) */
  ruleId: string;

  /** Pesan deskriptif */
  message: string;

  /** Lokasi di konten (kutipan teks atau section) */
  location?: string;

  /** Saran perbaikan */
  suggestion?: string;

  /** Confidence score 0-1 (untuk LLM classifier; baseline policy selalu 1.0) */
  confidence: number;
}

/**
 * Hasil safety review.
 */
export interface SafetyReviewResult {
  /** Apakah video lolos untuk export otomatis (tidak ada baseline policy block) */
  passed: boolean;

  /** Findings dari lapis 1 (baseline policy) — severity 'block' */
  baselinePolicyFindings: SafetyFinding[];

  /** Findings dari lapis 2 (rating-consistency) — severity 'warning' atau 'info' */
  ratingConsistencyFindings: SafetyFinding[];

  /** Semua findings gabungan */
  allFindings: SafetyFinding[];

  /** Apakah ada baseline policy violation (hard-block) */
  hasBaselineViolation: boolean;

  /** Apakah ada rating-consistency warning */
  hasRatingWarning: boolean;

  /** Severity keseluruhan */
  overallSeverity: 'ok' | 'warning' | 'blocked';

  /** Ringkasan satu kalimat */
  summary: string;

  /** Rating yang dipakai untuk review */
  contentRating: ContentRating;

  /** Apakah LLM classifier dipakai (lapis 2) */
  llmClassifierUsed: boolean;
}

// ============================================================
// Lapis 1 — Baseline Platform Policy (deterministik, HARD-BLOCK)
// ============================================================

/**
 * Definisi rule baseline platform policy.
 * Berlaku ke SEMUA universe apapun rating-nya.
 */
interface BaselinePolicyRule {
  /** ID rule unik */
  id: string;

  /** Nama rule */
  name: string;

  /** Kategori */
  category: SafetyCategory;

  /** Pattern regex yang trigger violation */
  pattern: RegExp;

  /** Pesan violation */
  message: string;

  /** Saran perbaikan */
  suggestion: string;
}

/**
 * Database rule baseline platform policy.
 *
 * PENTING: Rule-rule ini berlaku ke SEMUA universe — ALL_AGES, TEEN, MATURE.
 * Tidak ada yang mengasumsikan audiens anak secara default. Ini standar
 * trust & safety platform: konten ilegal, ujaran kebencian, konten seksual
 * non-konsensual, promosi kekerasan nyata.
 */
const BASELINE_POLICY_RULES: BaselinePolicyRule[] = [
  // --- Konten ilegal ---
  {
    id: 'baseline-illegal-csam',
    name: 'Child Sexual Abuse Material',
    category: 'illegal-content',
    pattern: /\b(pedofilia|paedofilia|child (sexual )?abuse|csam|pelecehan seksual anak|eksploitasi seksual anak)\b/i,
    message: 'Konten yang melibatkan eksploitasi/pelecehan seksual anak dilarang mutlak di semua universe (baseline platform policy).',
    suggestion: 'Hapus sepenuhnya. Ini pelanggaran hukum dan kebijakan platform yang tidak dapat di-override.',
  },
  {
    id: 'baseline-illegal-terrorism',
    name: 'Terrorism Promotion',
    category: 'violence-promotion',
    pattern: /\b(promosi terorisme|incit(e|ing) (to )?violence|recruit(ing)? (for )?terror|glorif(y|ication) (of )?terror)\b/i,
    message: 'Promosi/recruitment/glorifikasi terorisme dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus atau bingkai dengan jelas sebagai anti-narasi edukatif.',
  },
  {
    id: 'baseline-illegal-drugs-manufacturing',
    name: 'Drug Manufacturing Instructions',
    category: 'illegal-content',
    pattern: /\b(cara membuat (narkoba|ganja|sabu|ekstasi)|drug (manufacturing|synthesis) (recipe|instructions)|resep (narkoba|ganja))\b/i,
    message: 'Instruksi pembuatan narkoba dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus instruksi pembuatan substansi ilegal sepenuhnya.',
  },

  // --- Ujaran kebencian terhadap kelompok terlindungi ---
  {
    id: 'baseline-hate-speech-racial',
    name: 'Racial Hate Speech',
    category: 'hate-speech',
    pattern: /\b(bangsa (kafir|hina)|ras (rendahan|inferior)|ethnic cleansing|pembasmian ras|genocide (of|against))\b/i,
    message: 'Ujaran kebencian rasial/etnis dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus narasi yang mendelegitimasi atau menghasut kekerasan terhadap kelompok ras/etnis.',
  },
  {
    id: 'baseline-hate-speech-religious',
    name: 'Religious Hate Speech',
    category: 'hate-speech',
    pattern: /\b(agama (sesat|kotor)|kill (all )?(muslims|christians|jews|hindus|buddhists)|basmi (umat|agama))\b/i,
    message: 'Ujaran kebencian agama dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus narasi yang menghasut kekerasan terhadap kelompok agama.',
  },
  {
    id: 'baseline-hate-speech-disability',
    name: 'Disability Hate Speech',
    category: 'hate-speech',
    pattern: /\b(disabled (people (are )?(worthless|useless|burden))|cacat (mental|fisik) (tidak berguna|beban))\b/i,
    message: 'Ujaran kebencian terhadap penyandang disabilitas dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus narasi yang merendahkan kelompok disabilitas.',
  },

  // --- Konten seksual non-konsensual ---
  {
    id: 'baseline-nonconsensual-csam-adjacent',
    name: 'Non-Consensual Sexual Content (Minors)',
    category: 'non-consensual-sexual-content',
    pattern: /\b(non-?consensual (sexual )?(minor|child|underage))|forced (sexual|sex) (minor|child|underage)\b/i,
    message: 'Konten seksual non-konsensual yang melibatkan anak dilarang mutlak (baseline platform policy).',
    suggestion: 'Hapus sepenuhnya. Ini pelanggaran hukum dan kebijakan platform.',
  },
  {
    id: 'baseline-nonconsensual-revenge-porn',
    name: 'Non-Consensual Intimate Imagery',
    category: 'non-consensual-sexual-content',
    pattern: /\b(revenge porn|non-?consensual (intimate|sexual) (image|video|photo)|sebar (foto|video) (telanjang|intim) tanpa izin)\b/i,
    message: 'Penyebaran konten intim tanpa persetujuan dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus referensi ke non-consensual intimate imagery.',
  },
  {
    id: 'baseline-nonconsensual-sexual-violence',
    name: 'Sexual Violence Depiction',
    category: 'non-consensual-sexual-content',
    pattern: /\b(rape|pemerkosaan|sexual assault|pelecehan seksual paksa|forced (sex|sexual))\b/i,
    message: 'Depiksi kekerasan seksual non-konsensual dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus atau bingkai dengan sangat hati-hati sebagai anti-narasi edukatif jika diperlukan untuk cerita.',
  },

  // --- Promosi kekerasan nyata ---
  {
    id: 'baseline-violence-real-harm',
    name: 'Real Violence Promotion',
    category: 'violence-promotion',
    pattern: /\b(how to (hurt|kill|attack) (someone|people)|cara (menyakiti|membunuh|menyerang) (orang|manusia))|encourag(e|ing) (self-?harm|suicide)\b/i,
    message: 'Promosi/instruksi kekerasan nyata terhadap individu dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus instruksi atau promosi kekerasan nyata.',
  },
  {
    id: 'baseline-violence-self-harm-promotion',
    name: 'Self-Harm Promotion',
    category: 'violence-promotion',
    pattern: /\b(how to (commit )?suicide|cara (bunuh diri|melukai diri)|encourag(e|ing) (you )?to (kill|hurt) (yourself|diri sendiri))\b/i,
    message: 'Promosi/mendorong self-harm/suicide dilarang di semua universe (baseline platform policy).',
    suggestion: 'Hapus atau ganti dengan sumber bantuan/prevensi jika konteksnya edukatif.',
  },
];

/**
 * Jalankan lapis 1 — baseline platform policy check (deterministik).
 *
 * Rule-rule ini berlaku ke SEMUA universe apapun rating-nya.
 * Hasil: violation (block) — video TIDAK boleh di-export otomatis.
 *
 * @param content Konten yang akan dicek
 * @returns Findings dari baseline policy (severity 'block' kalau ada match)
 */
export function checkBaselinePolicy(content: string): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  const contentLower = content.toLowerCase();

  for (const rule of BASELINE_POLICY_RULES) {
    const matches = contentLower.match(new RegExp(rule.pattern.source, 'gi'));
    if (matches) {
      // Cari lokasi (kutipan teks di sekitar match)
      const matchIndex = contentLower.search(rule.pattern);
      const location = matchIndex >= 0
        ? content.substring(
            Math.max(0, matchIndex - 30),
            Math.min(content.length, matchIndex + rule.pattern.source.length + 30),
          ).trim()
        : undefined;

      findings.push({
        layer: 'baseline-policy',
        severity: 'block',
        category: rule.category,
        ruleId: rule.id,
        message: rule.message,
        location: location ? `"…${location}…"` : undefined,
        suggestion: rule.suggestion,
        confidence: 1.0, // Baseline policy = deterministic, confidence selalu 1.0
      });
    }
  }

  return findings;
}

// ============================================================
// Lapis 2 — Rating-Consistency Check (LLM classifier, WARNING)
// ============================================================

/**
 * System prompt untuk LLM classifier rating-consistency.
 */
const RATING_CONSISTENCY_SYSTEM_PROMPT = `You are a content rating consistency classifier for a video creation platform.
Your job is to evaluate whether video content is consistent with the content rating
that the creator has declared for their universe.

IMPORTANT PRINCIPLES:
- You are NOT a censor. The creator has chosen their rating — you only check consistency.
- ALL_AGES: Content should be suitable for all ages including children. Intense violence,
  sexual content, strong language, and drug references are inconsistent with this rating.
- TEEN: Content should be suitable for teenagers. Mild conflict OK, but explicit sexual
  content, graphic violence, and hard drugs are inconsistent.
- MATURE: Content can include intense themes, violence, and strong language. Only flag
  if content is EXTREMELY inconsistent (e.g., content that would be inappropriate even
  for adults in unregulated contexts).

Your output is a WARNING, not a block. The creator can still export with full awareness.

Return ONLY valid JSON:
{
  "findings": [
    {
      "category": "rating-mismatch|tone-mismatch|intensity-mismatch|theme-mismatch",
      "severity": "warning|info",
      "message": "Descriptive message in Indonesian",
      "location": "Relevant text excerpt",
      "suggestion": "Improvement suggestion in Indonesian",
      "confidence": 0.0-1.0
    }
  ],
  "overallConsistency": 0.0-1.0,
  "summary": "One sentence summary in Indonesian"
}`;

/**
 * Build prompt untuk LLM classifier rating-consistency.
 */
function buildRatingConsistencyPrompt(input: SafetyReviewInput): string {
  const { content, contentRating, audienceProfile, videoMetadata } = input;

  const parts: string[] = [];

  parts.push(`CONTENT RATING: ${contentRating}`);
  if (audienceProfile) {
    parts.push(`AUDIENCE PROFILE: ${audienceProfile}`);
  }
  parts.push('');

  if (videoMetadata?.title) {
    parts.push(`VIDEO TITLE: ${videoMetadata.title}`);
  }

  if (videoMetadata?.shotDescriptions && videoMetadata.shotDescriptions.length > 0) {
    parts.push('SHOT DESCRIPTIONS:');
    videoMetadata.shotDescriptions.forEach((desc, i) => {
      parts.push(`  Shot ${i + 1}: ${desc}`);
    });
  }

  if (videoMetadata?.dialogueText) {
    parts.push(`DIALOGUE: ${videoMetadata.dialogueText}`);
  }

  parts.push('');
  parts.push('CONTENT TO EVALUATE:');
  parts.push('---');
  parts.push(content);
  parts.push('---');
  parts.push('');
  parts.push('Evaluate whether this content is consistent with the declared content rating.');
  parts.push('Return JSON as specified in the system prompt.');

  return parts.join('\n');
}

/**
 * Parse response dari LLM classifier.
 */
function parseRatingConsistencyResponse(
  responseContent: string,
  contentRating: ContentRating
): SafetyFinding[] {
  try {
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      findings?: Array<{
        category?: string;
        severity?: string;
        message?: string;
        location?: string;
        suggestion?: string;
        confidence?: number;
      }>;
    };

    if (!parsed.findings || !Array.isArray(parsed.findings)) {
      return [];
    }

    const validCategories: SafetyCategory[] = [
      'rating-mismatch', 'tone-mismatch', 'intensity-mismatch', 'theme-mismatch',
    ];
    const validSeverities: SafetySeverity[] = ['warning', 'info'];

    return parsed.findings
      .filter((f) => f && f.message)
      .map((f, index) => {
        const category = (validCategories.includes(f.category as SafetyCategory)
          ? f.category
          : 'rating-mismatch') as SafetyCategory;

        const severity = (validSeverities.includes(f.severity as SafetySeverity)
          ? f.severity
          : 'warning') as SafetySeverity;

        return {
          layer: 'rating-consistency' as const,
          severity,
          category,
          ruleId: `llm-classifier-${index}`,
          message: f.message!,
          location: f.location,
          suggestion: f.suggestion,
          confidence: typeof f.confidence === 'number' ? f.confidence : 0.7,
        };
      });
  } catch {
    // Kalau parsing gagal, return empty — jangan block export karena LLM error
    return [];
  }
}

/**
 * Jalankan lapis 2 — rating-consistency check (LLM classifier).
 *
 * Membandingkan output dengan `Universe.contentRating`/`audienceProfile`
 * yang dideklarasikan creator. Hasil: WARNING (bukan hard-block).
 *
 * @param input Konten + rating + audience profile
 * @param provider AIProvider untuk LLM classifier (Claude)
 * @param options Opsi LLM
 * @returns Findings dari rating-consistency (severity 'warning' atau 'info')
 */
export async function checkRatingConsistency(
  input: SafetyReviewInput,
  provider?: AIProvider,
  options: AIProviderOptions = {}
): Promise<SafetyFinding[]> {
  // Kalau tidak ada provider, skip LLM classifier — return empty
  if (!provider) {
    return [];
  }

  const prompt = buildRatingConsistencyPrompt(input);

  const llmOptions: AIProviderOptions = {
    ...options,
    model: options.model || 'claude-3-5-sonnet-20241022',
    temperature: 0.1, // Low temperature for consistent classification
    maxTokens: 2000,
    systemPrompt: RATING_CONSISTENCY_SYSTEM_PROMPT,
  };

  try {
    const response = await provider.generate(prompt, llmOptions);
    return parseRatingConsistencyResponse(response.content, input.contentRating);
  } catch {
    // Kalau LLM error, jangan block export — return empty findings
    // Baseline policy (lapis 1) tetap berjalan sebagai safety net
    return [];
  }
}

// ============================================================
// Main Orchestrator — reviewSafety()
// ============================================================

/**
 * Jalankan safety review lengkap — dua lapis.
 *
 * Lapis 1 (baseline policy) selalu dijalankan — deterministik, hard-block.
 * Lapis 2 (rating-consistency) dijalankan kalau AIProvider tersedia — LLM, warning.
 *
 * @param input Konten + rating + audience profile
 * @param provider AIProvider opsional untuk LLM classifier (lapis 2)
 * @param options Opsi LLM
 * @returns Hasil safety review lengkap
 */
export async function reviewSafety(
  input: SafetyReviewInput,
  provider?: AIProvider,
  options: AIProviderOptions = {}
): Promise<SafetyReviewResult> {
  // Lapis 1 — baseline policy (selalu dijalankan, deterministik)
  const baselinePolicyFindings = checkBaselinePolicy(input.content);

  // Lapis 2 — rating-consistency (LLM classifier, opsional)
  const ratingConsistencyFindings = await checkRatingConsistency(input, provider, options);

  // Gabungkan semua findings
  const allFindings = [...baselinePolicyFindings, ...ratingConsistencyFindings];

  // Determine flags
  const hasBaselineViolation = baselinePolicyFindings.length > 0;
  const hasRatingWarning = ratingConsistencyFindings.some(f => f.severity === 'warning');

  // Overall severity
  let overallSeverity: SafetyReviewResult['overallSeverity'] = 'ok';
  if (hasBaselineViolation) {
    overallSeverity = 'blocked';
  } else if (hasRatingWarning) {
    overallSeverity = 'warning';
  }

  // Passed = tidak ada baseline violation (rating warning tidak block)
  const passed = !hasBaselineViolation;

  // Summary
  let summary: string;
  if (hasBaselineViolation) {
    summary = `${baselinePolicyFindings.length} baseline policy violation ditemukan — video diblokir dari export otomatis.`;
  } else if (hasRatingWarning) {
    const warningCount = ratingConsistencyFindings.filter(f => f.severity === 'warning').length;
    summary = `${warningCount} rating-consistency warning untuk rating ${input.contentRating}. Video lolos tapi perlu perhatian creator.`;
  } else if (ratingConsistencyFindings.length > 0) {
    summary = `${ratingConsistencyFindings.length} info finding untuk rating ${input.contentRating}. Video lolos.`;
  } else {
    summary = `Video lolos safety review untuk rating ${input.contentRating}.`;
  }

  return {
    passed,
    baselinePolicyFindings,
    ratingConsistencyFindings,
    allFindings,
    hasBaselineViolation,
    hasRatingWarning,
    overallSeverity,
    summary,
    contentRating: input.contentRating,
    llmClassifierUsed: !!provider,
  };
}

// ============================================================
// Helper — cek apakah export diizinkan
// ============================================================

/**
 * Tentukan apakah video diizinkan untuk export berdasarkan hasil safety review.
 *
 * Aturan:
 * - Baseline policy violation → BLOCK (wajib perbaiki sebelum export)
 * - Rating-consistency warning → ALLOW (creator tetap bisa export dengan kesadaran)
 * - Tidak ada finding → ALLOW
 *
 * @param result Hasil safety review
 * @returns Apakah export diizinkan
 */
export function isExportAllowed(result: SafetyReviewResult): boolean {
  return !result.hasBaselineViolation;
}

/**
 * Tentukan apakah human approval WAJIB sebelum export.
 *
 * Aturan (sesuai VF-5.4):
 * - Baseline policy violation → WAJIB approval (harus diperbaiki atau di-approve reviewer)
 * - Rating-consistency warning → opsional/informational (creator bisa export tanpa approval)
 *
 * @param result Hasil safety review
 * @returns Apakah human approval wajib
 */
export function requiresHumanApproval(result: SafetyReviewResult): boolean {
  return result.hasBaselineViolation;
}