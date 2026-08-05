/**
 * Tests for VF-5.2 — Canon check final
 */

import { describe, it, expect } from 'vitest';
import { CanonValidator, RuleEngine, type VideoFinalCanonContext } from '../src/validate/canon.js';
import type { VideoCharacterContext, ContentRating } from '@suro-buya/shared';

function mkChar(o={}){return Object.assign({id:"c1",characterId:"suro",displayName:"Suro",role:"PROTAGONIST",description:"Anak hiu",coreTraits:["pemberani","ingin tahu"],coreWeakness:"penakut pada gelap",voiceGuide:"Ceria",metadata:{species:"anak hiu",ageDescriptor:"9 tahun",motivation:"Jelajah",visualDescription:"Anak hiu biru",personaSource:"manual"}},o)}
function mkCtx(o={}){return Object.assign({character:mkChar(),contentRating:"ALL_AGES"},o)}
function mkVal(){return new CanonValidator(new RuleEngine(),undefined,false)}
describe('VF-5.2 basic', () => {
  it('pass clean', async () => {
    const v = mkVal(); 
    const r = await v.validateVideoFinal('Suro menjelajah lautan dengan pemberani. Dia ingin tahu.', mkCtx()); 
    expect(r.valid).toBe(true); 
    expect(r.errors).toHaveLength(0); 
  }); 
}); 
describe('VF-5.2 acceptance', () => {
  it('flag persona without safety', async () => {
    const v = mkVal(); 
    const r = await v.validateVideoFinal('Suro tiba-tiba menjadi sangat pemberani tanpa rasa takut sama sekali.', mkCtx()); 
    expect(r.valid).toBe(false); 
    expect(r.violations.some(x => x.rule === 'video-persona-weakness-contradiction')).toBe(true); 
  }); 
}); 
describe('VF-5.2 score', () => {
  it('1.0 for no violations', async () => {
    const v = mkVal(); 
    const r = await v.validateVideoFinal('Suro menjelajah lautan dengan pemberani. Dia ingin tahu.', mkCtx()); 
    expect(r.consistencyScore).toBe(1.0); 
  }); 
}); 
