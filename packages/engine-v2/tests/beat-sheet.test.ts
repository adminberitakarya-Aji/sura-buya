/**
 * Tests for VF-2.3 — beat-sheet.ts
 */

import { describe, it, expect } from 'vitest';
import {
  generateBeatSheet,
  validateScriptAgainstBeats,
  estimateTotalShotCount,
  type VideoDuration,
  type BeatSheet,
} from '../src/script/beat-sheet.js';

describe('beat-sheet — generateBeatSheet', () => {
  it('should generate 3 beats for 15-second video', () => {
    const sheet = generateBeatSheet(15);
    expect(sheet.duration).toBe(15);
    expect(sheet.totalBeats).toBe(3);
    expect(sheet.beats).toHaveLength(3);
    expect(sheet.beats[0].label).toBe('Hook');
    expect(sheet.beats[1].label).toBe('Conflict');
    expect(sheet.beats[2].label).toBe('Punchline');
  });

  it('should generate 5 beats for 30-second video', () => {
    const sheet = generateBeatSheet(30);
    expect(sheet.duration).toBe(30);
    expect(sheet.totalBeats).toBe(5);
    expect(sheet.beats[0].label).toBe('Hook');
    expect(sheet.beats[1].label).toBe('Setup');
    expect(sheet.beats[2].label).toBe('Conflict');
    expect(sheet.beats[3].label).toBe('Climax');
    expect(sheet.beats[4].label).toBe('Resolution');
  });

  it('should generate 7 beats for 60-second video', () => {
    const sheet = generateBeatSheet(60);
    expect(sheet.duration).toBe(60);
    expect(sheet.totalBeats).toBe(7);
    expect(sheet.beats[0].label).toBe('Hook');
    expect(sheet.beats[1].label).toBe('Setup');
    expect(sheet.beats[2].label).toBe('Inciting Incident');
    expect(sheet.beats[3].label).toBe('Rising Action');
    expect(sheet.beats[4].label).toBe('Climax');
    expect(sheet.beats[5].label).toBe('Falling Action');
    expect(sheet.beats[6].label).toBe('Resolution');
  });

  it('should have beats with sequential 0-based indices', () => {
    const sheet = generateBeatSheet(30);
    sheet.beats.forEach((beat, i) => {
      expect(beat.index).toBe(i);
    });
  });

  it('should have total duration equal to target duration', () => {
    expect(generateBeatSheet(15).totalDuration).toBe(15);
    expect(generateBeatSheet(30).totalDuration).toBe(30);
    expect(generateBeatSheet(60).totalDuration).toBe(60);
  });

  it('should have all beats with positive duration', () => {
    for (const duration of [15, 30, 60] as VideoDuration[]) {
      const sheet = generateBeatSheet(duration);
      for (const beat of sheet.beats) {
        expect(beat.durationSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('should have all beats with a type', () => {
    const validTypes = ['hook', 'setup', 'conflict', 'rising-action', 'climax', 'falling-action', 'resolution', 'punchline'];
    for (const duration of [15, 30, 60] as VideoDuration[]) {
      const sheet = generateBeatSheet(duration);
      for (const beat of sheet.beats) {
        expect(validTypes).toContain(beat.type);
      }
    }
  });
});

describe('beat-sheet — estimateTotalShotCount', () => {
  it('should estimate shot count for 15-second beat sheet', () => {
    const sheet = generateBeatSheet(15);
    const shotCount = estimateTotalShotCount(sheet);
    // 15s: Hook(4s->1), Conflict(7s->2), Punchline(4s->1) = 4
    expect(shotCount).toBe(4);
  });

  it('should estimate shot count for 30-second beat sheet', () => {
    const sheet = generateBeatSheet(30);
    const shotCount = estimateTotalShotCount(sheet);
    // 30s: Hook(5s->2), Setup(6s->2), Conflict(8s->2), Climax(6s->2), Resolution(5s->2) = 10
    expect(shotCount).toBe(10);
  });

  it('should estimate shot count for 60-second beat sheet', () => {
    const sheet = generateBeatSheet(60);
    const shotCount = estimateTotalShotCount(sheet);
    // 60s: Hook(6s->2), Setup(8s->2), Inciting(8s->2), Rising(12s->3), Climax(10s->3), Falling(8s->2), Resolution(8s->2) = 16
    expect(shotCount).toBe(16);
  });
});

describe('beat-sheet — validateScriptAgainstBeats', () => {
  it('should pass for script with appropriate length', () => {
    const sheet = generateBeatSheet(15);
    // 15s * 2 = 30 min words, 15s * 6 = 90 max words
    // Need at least 3 paragraphs (for 3 beats) and 30+ words
    const script = 'Hook: Suro menemukan harta karun yang berkilauan di dasar laut.\n\nConflict: Tiba-tiba hiu besar muncul dan menghalangi jalan Suro menuju harta tersebut.\n\nPunchline: Ternyata harta itu cuma kerang kosong, tapi Suro belajar bahwa petualangan itu sendiri yang berharga.';
    const result = validateScriptAgainstBeats(script, sheet);
    expect(result.warnings).toHaveLength(0);
    expect(result.valid).toBe(true);
    expect(result.structureScore).toBe(1);
  });

  it('should warn for script too short', () => {
    const sheet = generateBeatSheet(30);
    const script = 'Singkat sekali.';
    const result = validateScriptAgainstBeats(script, sheet);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
    expect(result.structureScore).toBeLessThan(1);
  });

  it('should warn for script too long', () => {
    const sheet = generateBeatSheet(15);
    // 15s * 6 = 90 max words — make it way longer (100 words)
    const script = Array(100).fill('kata').join(' ');
    const result = validateScriptAgainstBeats(script, sheet);
    expect(result.warnings.some(w => w.includes('terlalu panjang'))).toBe(true);
  });

  it('should warn for too few paragraphs', () => {
    const sheet = generateBeatSheet(60);
    // 60s needs 7 beats but only 1 paragraph
    const script = 'Ini naskah yang cukup panjang dengan banyak kata tapi hanya satu paragraf saja tanpa ada pemisah paragraf yang cukup.';
    const result = validateScriptAgainstBeats(script, sheet);
    expect(result.warnings.some(w => w.includes('paragraf'))).toBe(true);
  });

  it('should return estimatedShotCount in validation result', () => {
    const sheet = generateBeatSheet(30);
    const script = 'Test script.';
    const result = validateScriptAgainstBeats(script, sheet);
    expect(result.estimatedShotCount).toBe(estimateTotalShotCount(sheet));
  });
});