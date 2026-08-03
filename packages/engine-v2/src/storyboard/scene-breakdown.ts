/**
 * Suro-Buya Engine v2 - Scene Breakdown (VF-2.5)
 *
 * Naskah → shot list terstruktur (ShotSpec[]). Membagi naskah berdasarkan
 * beat sheet (VF-2.3) menjadi shot-shot individual dengan camera angle,
 * duration, dialogue, action, dan visual prompt.
 *
 * Output ShotSpec[] dikonsumsi oleh:
 * - prompt-builder.ts (VF-2.5) untuk build visual/motion prompt
 * - visual/image-generator.ts (VF-3) untuk generate keyframe
 * - motion/animation-generator.ts (VF-3) untuk generate video clip
 *
 * PENTING: modul ini murni fungsi deterministik — tidak panggil AI provider,
 * tidak akses database. Pola yang sama dengan beat-sheet.ts (VF-2.3).
 */

import type { ShotSpec } from '@suro-buya/shared';
import type { VideoCharacterContext } from '@suro-buya/shared';
import type { BeatSheet, Beat } from '../script/beat-sheet.js';
import { estimateTotalShotCount } from '../script/beat-sheet.js';

/**
 * Input untuk scene breakdown.
 */
export interface SceneBreakdownInput {
  /** Naskah yang sudah digenerate (VF-2.2) */
  script: string;

  /** Beat sheet yang dipakai sebagai struktur (VF-2.3) */
  beatSheet: BeatSheet;

  /** Karakter utama — VideoCharacterContext (VF-2.0) */
  character: VideoCharacterContext;
}

/**
 * Hasil scene breakdown.
 */
export interface SceneBreakdownResult {
  /** Shot list terstruktur */
  shots: ShotSpec[];

  /** Total shot */
  totalShots: number;

  /** Total durasi (harus mendekati beatSheet.duration) */
  totalDuration: number;

  /** Beat yang tercakup */
  beatsCovered: number;

  /** Warning jika ada masalah */
  warnings: string[];
}

/**
 * Parse naskah menjadi segmen berdasarkan beat labels.
 * Format yang diharapkan: "[Beat 1: Hook]" atau "[Hook]" sebagai separator.
 */
function parseScriptByBeats(script: string, beatSheet: BeatSheet): Map<number, string> {
  const segments = new Map<number, string>();

  // Cari semua marker beat di naskah
  const beatMarkers: Array<{ beatIndex: number; position: number }> = [];

  for (const beat of beatSheet.beats) {
    // Cari berbagai format marker: [Beat 1: Hook], [Hook], [Beat 1]
    const patterns = [
      new RegExp(`\\[Beat\\s+${beat.index + 1}[^\\]]*${beat.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*\\]`, 'i'),
      new RegExp(`\\[Beat\\s+${beat.index + 1}[^\\]]*\\]`, 'i'),
      new RegExp(`\\[${beat.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*\\]`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = script.match(pattern);
      if (match && match.index !== undefined) {
        beatMarkers.push({ beatIndex: beat.index, position: match.index });
        break;
      }
    }
  }

  // Sort by position
  beatMarkers.sort((a, b) => a.position - b.position);

  if (beatMarkers.length === 0) {
    // Tidak ada marker — treat seluruh naskah sebagai satu segmen untuk beat 0
    segments.set(0, script);
    return segments;
  }

  // Split naskah berdasarkan marker positions
  for (let i = 0; i < beatMarkers.length; i++) {
    const marker = beatMarkers[i];
    if (!marker) continue;
    const start = marker.position;
    const nextMarker = i + 1 < beatMarkers.length ? beatMarkers[i + 1] : undefined;
    const end = nextMarker ? nextMarker.position : script.length;
    const segment = script.substring(start, end).trim();
    segments.set(marker.beatIndex, segment);
  }

  return segments;
}

/**
 * Extract dialog dari segmen naskah.
 * Format: "CHARACTER: dialog" atau "KARAKTER: dialog"
 */
function extractDialogue(segment: string, character: VideoCharacterContext): ShotSpec['dialogue'] | undefined {
  // Cari pattern "NAMA: dialog" di mana NAMA adalah displayName atau characterId
  const displayNameUpper = character.displayName.toUpperCase();
  const characterIdUpper = character.characterId.toUpperCase();

  const patterns = [
    new RegExp(`${displayNameUpper}\\s*:\\s*(.+?)(?:\\n|$)`, 's'),
    new RegExp(`${characterIdUpper}\\s*:\\s*(.+?)(?:\\n|$)`, 's'),
  ];

  for (const pattern of patterns) {
    const match = segment.match(pattern);
    if (match) {
      const matchGroup = match[1];
      if (matchGroup !== undefined) {
        const line = matchGroup.trim().replace(/^["']|["']$/g, '');
        if (line.length > 0) {
          return {
            characterId: character.id,
            line,
          };
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract action description dari segmen naskah.
 * Format: [deskripsi aksi] atau teks di luar dialog
 */
function extractAction(segment: string, character: VideoCharacterContext): string {
  // Hapus dialog lines
  const displayNameUpper = character.displayName.toUpperCase();
  const characterIdUpper = character.characterId.toUpperCase();

  let action = segment
    .replace(new RegExp(`${displayNameUpper}\\s*:\\s*.+`, 'g'), '')
    .replace(new RegExp(`${characterIdUpper}\\s*:\\s*.+`, 'g'), '');

  // Hapus beat markers
  action = action.replace(/\[Beat\s+\d+[^\]]*\]/gi, '');
  action = action.replace(/\[Hook[^\]]*\]/gi, '');
  action = action.replace(/\[Setup[^\]]*\]/gi, '');
  action = action.replace(/\[Conflict[^\]]*\]/gi, '');
  action = action.replace(/\[Climax[^\]]*\]/gi, '');
  action = action.replace(/\[Resolution[^\]]*\]/gi, '');
  action = action.replace(/\[Punchline[^\]]*\]/gi, '');
  action = action.replace(/\[Inciting[^\]]*\]/gi, '');
  action = action.replace(/\[Rising[^\]]*\]/gi, '');
  action = action.replace(/\[Falling[^\]]*\]/gi, '');

  // Extract bracketed action descriptions
  const bracketMatches = action.match(/\[([^\]]+)\]/g);
  if (bracketMatches && bracketMatches.length > 0) {
    return bracketMatches.map(b => b.replace(/^\[|\]$/g, '')).join(' ');
  }

  // Fallback: use cleaned text
  return action.trim() || 'Karakter beraksi di scene ini';
}

/**
 * Tentukan camera angle berdasarkan beat type dan durasi.
 */
function determineCameraAngle(beat: Beat, shotIndex: number): string {
  const baseAngles: Record<Beat['type'], string[]> = {
    'hook': ['wide shot', 'close-up', 'medium shot'],
    'setup': ['medium shot', 'wide shot', 'over-the-shoulder'],
    'conflict': ['close-up', 'medium shot', 'wide shot'],
    'rising-action': ['medium shot', 'close-up', 'wide shot'],
    'climax': ['close-up', 'extreme close-up', 'medium shot'],
    'falling-action': ['medium shot', 'wide shot', 'close-up'],
    'resolution': ['wide shot', 'medium shot', 'close-up'],
    'punchline': ['close-up', 'medium shot', 'wide shot'],
  };

  const angles = baseAngles[beat.type] || ['medium shot'];
  return angles[shotIndex % angles.length] || 'medium shot';
}

/**
 * Build initial visual prompt untuk shot.
 * Prompt lengkap dibangun di prompt-builder.ts (VF-2.5).
 */
function buildInitialVisualPrompt(beat: Beat, action: string, character: VideoCharacterContext): string {
  const charDesc = character.metadata.visualDescription || character.description;
  return `${action}. Character: ${character.displayName} (${charDesc}). Scene type: ${beat.type}.`;
}

/**
 * Break down naskah menjadi shot list terstruktur.
 *
 * @param input Naskah + beat sheet + character context
 * @returns ShotSpec[] + metadata
 */
export function breakDownScript(input: SceneBreakdownInput): SceneBreakdownResult {
  const { script, beatSheet, character } = input;

  const warnings: string[] = [];
  const segments = parseScriptByBeats(script, beatSheet);

  const shots: ShotSpec[] = [];
  let shotIndex = 0;
  let beatsCovered = 0;

  for (const beat of beatSheet.beats) {
    const segment = segments.get(beat.index);

    if (!segment || segment.trim().length === 0) {
      warnings.push(`Beat ${beat.index + 1} (${beat.label}) tidak ditemukan di naskah.`);
      continue;
    }

    beatsCovered++;

    // Tentukan jumlah shot untuk beat ini berdasarkan durasi
    const shotsPerBeat = beat.durationSeconds <= 4 ? 1 : beat.durationSeconds <= 8 ? 2 : 3;
    const durationPerShot = beat.durationSeconds / shotsPerBeat;

    for (let s = 0; s < shotsPerBeat; s++) {
      const dialogue = s === 0 ? extractDialogue(segment, character) : undefined;
      const action = extractAction(segment, character);
      const cameraAngle = determineCameraAngle(beat, s);
      const visualPrompt = buildInitialVisualPrompt(beat, action, character);

      shots.push({
        index: shotIndex++,
        cameraAngle,
        duration: Math.round(durationPerShot * 10) / 10, // 1 decimal
        dialogue,
        action,
        visualPrompt,
        motionPrompt: beat.type === 'climax' ? 'dynamic camera movement' : beat.type === 'hook' ? 'slow zoom in' : undefined,
      });
    }
  }

  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const expectedShotCount = estimateTotalShotCount(beatSheet);

  if (shots.length < expectedShotCount * 0.5) {
    warnings.push(`Jumlah shot (${shots.length}) jauh lebih sedikit dari estimasi (${expectedShotCount}). Naskah mungkin terlalu pendek.`);
  }

  if (beatsCovered < beatSheet.totalBeats) {
    warnings.push(`Hanya ${beatsCovered} dari ${beatSheet.totalBeats} beat tercakup di naskah.`);
  }

  return {
    shots,
    totalShots: shots.length,
    totalDuration,
    beatsCovered,
    warnings,
  };
}