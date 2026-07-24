import type {
  SceneRequest,
  ValidationIssue,
  ValidationResult,
} from "../types/index.js";

/**
 * Validator ini SENGAJA sederhana dan rule-based (bukan "AI menilai AI").
 * Tujuannya: jaring pengaman cepat & murah untuk pelanggaran yang jelas,
 * bukan pengganti review manusia. Kalau nanti perlu penilaian yang lebih
 * halus (nada humor, apakah lucu tanpa merendahkan, dll), itu tetap
 * pekerjaan manusia (atau LLM-as-judge terpisah) — jangan dipaksakan
 * masuk sini sebagai regex.
 */

// Berasal dari World Rules: tidak ada kekerasan, senjata, kematian, horor.
const BANNED_PATTERNS: { pattern: RegExp; rule: string; message: string }[] = [
  {
    pattern: /\b(senjata|pistol|pedang|panah|granat)\b/i,
    rule: "world-rules.no-weapons",
    message: "Terdeteksi kata terkait senjata — dunia Suro & Buya tidak memuat senjata.",
  },
  {
    pattern: /\b(mati|meninggal|terbunuh|membunuh|tewas)\b/i,
    rule: "world-rules.no-death",
    message: "Terdeteksi kata terkait kematian — tidak diperbolehkan dalam canon.",
  },
  {
    pattern: /\b(darah|luka parah|berdarah)\b/i,
    rule: "world-rules.no-graphic-violence",
    message: "Terdeteksi kata terkait kekerasan grafis.",
  },
  {
    pattern: /\b(hantu|setan|kuntilanak|jin jahat)\b/i,
    rule: "world-rules.no-horror",
    message: "Terdeteksi elemen horor — dunia Suro & Buya bebas horor.",
  },
];

function checkBannedContent(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { pattern, rule, message } of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({ severity: "error", rule, message });
    }
  }
  return issues;
}

function checkCharacterPresence(
  text: string,
  request: SceneRequest
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lower = text.toLowerCase();

  if (request.characters.includes("suro") && !lower.includes("suro")) {
    issues.push({
      severity: "warning",
      rule: "character-presence.suro",
      message: "Suro diminta muncul di scene ini tapi namanya tidak terdeteksi di output.",
    });
  }
  if (request.characters.includes("buya") && !lower.includes("buya")) {
    issues.push({
      severity: "warning",
      rule: "character-presence.buya",
      message: "Buya diminta muncul di scene ini tapi namanya tidak terdeteksi di output.",
    });
  }
  return issues;
}

function checkBasicStructure(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (text.trim().length === 0) {
    issues.push({
      severity: "error",
      rule: "structure.empty",
      message: "Output kosong.",
    });
  }
  if (text.length > 6000) {
    issues.push({
      severity: "warning",
      rule: "structure.too-long",
      message: "Output cukup panjang untuk satu scene (>6000 karakter) — cek apakah perlu dipecah.",
    });
  }
  return issues;
}

export function validateScene(
  text: string,
  request: SceneRequest
): ValidationResult {
  const issues: ValidationIssue[] = [
    ...checkBasicStructure(text),
    ...checkBannedContent(text),
    ...checkCharacterPresence(text, request),
  ];

  const passed = !issues.some((i) => i.severity === "error");

  return { passed, issues };
}
