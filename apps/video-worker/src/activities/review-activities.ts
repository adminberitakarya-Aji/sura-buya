/**
 * Suro-Buya Video Worker — Review Activities (VF-5.4)
 *
 * Activity untuk menjalankan canon check final + safety review,
 * dan mengelola SafetyReviewLog (VF-5.3).
 *
 * Lihat IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-5.4:
 * "Temporal workflow: human-in-the-loop approval"
 */

import { prisma } from '../lib/db.js';
import type {
    CanonCheckResult,
    SafetyCheckResult,
    CreateSafetyReviewLogsInput,
    UpdateSafetyReviewLogsInput,
    ReviewActivities,
} from '../shared/review-interfaces.js';
import type { ContentRating, VideoCharacterContext } from '@suro-buya/shared';
import {
    CanonValidator,
    createDefaultRuleEngine,
    type VideoFinalCanonContext,
    type ValidationOptions,
} from '@suro-buya/engine-v2/validate/canon.js';
import type { CanonValidationResult } from '@suro-buya/engine-v2/validate.js';
import {
    reviewSafety,
    isExportAllowed,
    requiresHumanApproval,
    type SafetyReviewInput,
    type SafetyReviewResult,
    type SafetyFinding,
} from '@suro-buya/engine-v2/validate/safety-review.js';
import type { AIProvider, AIProviderOptions } from '@suro-buya/engine-v2/ai/providers.js';
import type { Character } from '@prisma/client';

/**
 * Helper: convert engine-v2 CanonValidationResult to CanonCheckResult (untuk transport ke workflow).
 */
function toCanonCheckResult(result: CanonValidationResult): CanonCheckResult {
    return {
        valid: result.valid,
        consistencyScore: result.consistencyScore,
        violations: result.violations.map((v) => ({
            rule: v.rule,
            severity: v.severity,
            location: v.location,
            expected: v.expected,
            actual: v.actual,
            suggestion: v.suggestion,
        })),
        errors: result.errors,
        warnings: result.warnings,
        infos: result.infos,
    };
}

/**
 * Helper: convert engine-v2 SafetyReviewResult to SafetyCheckResult (untuk transport ke workflow).
 */
function toSafetyCheckResult(result: SafetyReviewResult): SafetyCheckResult {
    return {
        passed: result.passed,
        baselinePolicyFindings: result.baselinePolicyFindings.map((f) => ({
            layer: 'baseline-policy' as const,
            severity: 'block' as const,
            category: f.category,
            ruleId: f.ruleId,
            message: f.message,
            location: f.location,
            suggestion: f.suggestion,
            confidence: f.confidence,
        })),
        ratingConsistencyFindings: result.ratingConsistencyFindings.map((f) => ({
            layer: 'rating-consistency' as const,
            severity: f.severity as 'warning' | 'info',
            category: f.category,
            ruleId: f.ruleId,
            message: f.message,
            location: f.location,
            suggestion: f.suggestion,
            confidence: f.confidence,
        })),
        allFindings: result.allFindings.map((f) => ({
            layer: f.layer,
            severity: f.severity,
            category: f.category,
            ruleId: f.ruleId,
            message: f.message,
            location: f.location,
            suggestion: f.suggestion,
            confidence: f.confidence,
        })),
        hasBaselineViolation: result.hasBaselineViolation,
        hasRatingWarning: result.hasRatingWarning,
        overallSeverity: result.overallSeverity,
        summary: result.summary,
        contentRating: result.contentRating,
        llmClassifierUsed: result.llmClassifierUsed,
    };
}

/**
 * Build VideoCharacterContext dari database untuk canon check.
 * Ini adalah bridge layer: ambil Character + CharacterAsset dari Prisma
 * dan map ke VideoCharacterContext (engine-v2) — sama seperti yang dilakukan
 * di apps/web API routes (VF-2.6).
 */
async function buildVideoCharacterContext(
    characterId: string,
    universeId: string
): Promise<VideoCharacterContext> {
    const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
            characterAsset: true,
            universe: { select: { contentRating: true, audienceProfile: true } },
        },
    });

    if (!character) {
        throw new Error(`Character not found: ${characterId}`);
    }

    if (character.universeId !== universeId) {
        throw new Error(`Character ${characterId} does not belong to universe ${universeId}`);
    }

    // Build VideoCharacterContext dari Character + CharacterAsset
    // Character.metadata berisi field dari PersonaDraft (VF-1.5)
    const metadata = (character.metadata as Record<string, unknown>) || {};

    return {
        id: character.id,
        characterId: character.characterId,
        displayName: character.displayName,
        role: character.role as VideoCharacterContext['role'],
        description: character.description ?? '',
        coreTraits: character.coreTraits,
        coreWeakness: character.coreWeakness,
        voiceGuide: character.voiceGuide ?? '',
        metadata: {
            species: (metadata['species'] as string) ?? 'unknown',
            ageDescriptor: (metadata['ageDescriptor'] as string) ?? 'unknown',
            motivation: (metadata['motivation'] as string) ?? null,
            visualDescription: (metadata['visualDescription'] as string) ?? '',
            personaSource: (metadata['personaSource'] as 'ai-parsed' | 'manual') ?? 'manual',
        },
        visualProfile: character.characterAsset
            ? {
                referenceImages: character.characterAsset.referenceImages,
                styleTags: [],
                colorPalette: [],
                negativePrompt: undefined,
                voiceProfile: character.characterAsset.voiceProfile as
                    | { provider: string; voiceId: string; settings?: Record<string, unknown> }
                    | undefined,
            }
            : undefined,
    };
}

/**
 * Build VideoFinalCanonContext untuk canon check final (VF-5.2).
 * Extend VideoCanonContext dengan shot descriptions + visual prompts.
 */
function buildVideoFinalCanonContext(
    charContext: VideoCharacterContext,
    input: {
        contentRating: ContentRating;
        audienceProfile?: string;
        seriesId?: string;
        episodeOrder?: number;
        shotDescriptions?: string[];
        visualPrompts?: string[];
        videoMetadata?: { title?: string; duration?: number; renderStatus?: string };
    }
): VideoFinalCanonContext {
    return {
        character: charContext,
        contentRating: input.contentRating,
        audienceProfile: input.audienceProfile,
        seriesContext: input.seriesId
            ? {
                seriesId: input.seriesId,
                episodeOrder: input.episodeOrder ?? 1,
                previousEpisodeSummaries: [], // TODO: ambil dari episode sebelumnya di series yang sama
            }
            : undefined,
        shotDescriptions: input.shotDescriptions,
        visualPrompts: input.visualPrompts,
        videoMetadata: input.videoMetadata,
    };
}

/**
 * Activity: Jalankan canon check final (VF-5.2).
 * Memanggil CanonValidator.validateVideoFinal() dari engine-v2.
 */
export async function runCanonCheckFinal(input: {
    projectId: string;
    universeId: string;
    script: string;
    shotDescriptions?: string[];
    visualPrompts?: string[];
    characterId: string;
    contentRating: ContentRating;
    audienceProfile?: string;
    seriesId?: string;
    episodeOrder?: number;
}): Promise<CanonCheckResult> {
    // 1. Build character context dari DB
    const charContext = await buildVideoCharacterContext(input.characterId, input.universeId);

    // 2. Build final canon context
    const finalContext = buildVideoFinalCanonContext(charContext, {
        contentRating: input.contentRating,
        audienceProfile: input.audienceProfile,
        seriesId: input.seriesId,
        episodeOrder: input.episodeOrder,
        shotDescriptions: input.shotDescriptions,
        visualPrompts: input.visualPrompts,
        videoMetadata: { title: input.projectId }, // placeholder
    });

    // 3. Setup CanonValidator
    // Note: LLM judge optional - gunakan default rule engine saja untuk sekarang
    const ruleEngine = createDefaultRuleEngine();
    const validator = new CanonValidator(ruleEngine);

    // 4. Run validateVideoFinal
    const options: ValidationOptions = {
        enableLLMJudge: false, // bisa di-enable nanti kalau ada AIProvider
    };

    const result = await validator.validateVideoFinal(input.script, finalContext, options);

    return toCanonCheckResult(result);
}

/**
 * Activity: Jalankan safety review (VF-5.1).
 * Memanggil reviewSafety() dari engine-v2/validate/safety-review.ts.
 */
export async function runSafetyReview(input: {
    projectId: string;
    universeId: string;
    content: string;
    contentRating: ContentRating;
    audienceProfile?: string;
    videoMetadata?: {
        title?: string;
        shotDescriptions?: string[];
        dialogueText?: string;
    };
}): Promise<SafetyCheckResult> {
    const safetyInput: SafetyReviewInput = {
        content: input.content,
        contentRating: input.contentRating,
        audienceProfile: input.audienceProfile,
        videoMetadata: input.videoMetadata,
    };

    // Note: LLM classifier optional - gunakan default tanpa provider untuk baseline policy
    // Untuk rating-consistency (LLM), bisa di-enable nanti kalau ada AIProvider
    const result = await reviewSafety(safetyInput);

    return toSafetyCheckResult(result);
}

/**
 * Activity: Buat SafetyReviewLog entries awal (VF-5.3).
 * Simpan canon findings + safety findings sebagai audit trail.
 */
export async function createSafetyReviewLogs(input: CreateSafetyReviewLogsInput): Promise<void> {
    const { projectId, universeId, contentRating, canonFindings, safetyFindings, overallStatus, requiresHumanApproval, approvalType } = input;

    // Determine initial status
    let initialStatus: 'PENDING' | 'AUTO_PASSED' | 'AUTO_BLOCKED';
    if (overallStatus === 'PASSED') {
        initialStatus = 'AUTO_PASSED';
    } else if (overallStatus === 'BLOCKED') {
        initialStatus = requiresHumanApproval ? 'PENDING' : 'AUTO_BLOCKED';
    } else if (overallStatus === 'WARNING') {
        initialStatus = 'PENDING';
    } else {
        initialStatus = 'PENDING';
    }

    // Create SafetyReviewLog entries for ALL findings (canon + safety)
    const allFindings = [
        ...canonFindings.map(f => ({
            projectId,
            universeId,
            reviewerId: null,
            status: initialStatus,
            layer: 'RATING_CONSISTENCY' as const, // canon findings di-map ke rating-consistency layer
            flaggedRule: f.rule,
            category: mapCanonRuleToCategory(f.rule),
            severity: mapCanonSeverityToSafety(f.severity),
            message: `${f.rule}: Expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`,
            location: f.location,
            suggestion: f.suggestion,
            confidence: 1.0,
            contentRating,
            videoMetadata: undefined,
        })),
        ...safetyFindings.map(f => ({
            projectId,
            universeId,
            reviewerId: null,
            status: initialStatus,
            layer: f.layer === 'baseline-policy' ? 'BASELINE_POLICY' as const : 'RATING_CONSISTENCY' as const,
            flaggedRule: f.ruleId,
            category: mapSafetyCategoryToEnum(f.category),
            severity: mapSafetySeverityToEnum(f.severity),
            message: f.message,
            location: f.location,
            suggestion: f.suggestion,
            confidence: f.confidence,
            contentRating,
            videoMetadata: undefined,
        })),
    ];

    // Batch insert all findings
    if (allFindings.length > 0) {
        await prisma.safetyReviewLog.createMany({
            data: allFindings,
        });
    }
}

/**
 * Map canon rule name ke SafetyCategory enum.
 */
function mapCanonRuleToCategory(rule: string): 'ILLEGAL_CONTENT' | 'HATE_SPEECH' | 'NON_CONSENSUAL_SEXUAL_CONTENT' | 'VIOLENCE_PROMOTION' | 'RATING_MISMATCH' | 'TONE_MISMATCH' | 'INTENSITY_MISMATCH' | 'THEME_MISMATCH' {
    if (rule.includes('weakness') || rule.includes('trait') || rule.includes('character')) {
        return 'THEME_MISMATCH'; // persona violation = theme mismatch
    }
    if (rule.includes('continuity') || rule.includes('series')) {
        return 'TONE_MISMATCH'; // continuity issue
    }
    return 'THEME_MISMATCH';
}

/**
 * Map canon severity ke SafetySeverity enum.
 */
function mapCanonSeverityToSafety(severity: 'error' | 'warning' | 'info'): 'BLOCK' | 'WARNING' | 'INFO' {
    switch (severity) {
        case 'error': return 'BLOCK';
        case 'warning': return 'WARNING';
        case 'info': return 'INFO';
    }
}

/**
 * Map safety category ke SafetyCategory enum.
 */
function mapSafetyCategoryToEnum(category: string): 'ILLEGAL_CONTENT' | 'HATE_SPEECH' | 'NON_CONSENSUAL_SEXUAL_CONTENT' | 'VIOLENCE_PROMOTION' | 'RATING_MISMATCH' | 'TONE_MISMATCH' | 'INTENSITY_MISMATCH' | 'THEME_MISMATCH' {
    switch (category) {
        case 'illegal-content': return 'ILLEGAL_CONTENT';
        case 'hate-speech': return 'HATE_SPEECH';
        case 'non-consensual-sexual-content': return 'NON_CONSENSUAL_SEXUAL_CONTENT';
        case 'violence-promotion': return 'VIOLENCE_PROMOTION';
        case 'rating-mismatch': return 'RATING_MISMATCH';
        case 'tone-mismatch': return 'TONE_MISMATCH';
        case 'intensity-mismatch': return 'INTENSITY_MISMATCH';
        case 'theme-mismatch': return 'THEME_MISMATCH';
        default: return 'THEME_MISMATCH';
    }
}

/**
 * Map safety severity ke SafetySeverity enum.
 */
function mapSafetySeverityToEnum(severity: 'block' | 'warning' | 'info'): 'BLOCK' | 'WARNING' | 'INFO' {
    switch (severity) {
        case 'block': return 'BLOCK';
        case 'warning': return 'WARNING';
        case 'info': return 'INFO';
    }
}

/**
 * Activity: Update SafetyReviewLog setelah human approval/rejection.
 */
export async function updateSafetyReviewLogs(input: UpdateSafetyReviewLogsInput): Promise<void> {
    const { projectId, status, reviewerId, feedback } = input;

    // Update semua SafetyReviewLog untuk project ini
    await prisma.safetyReviewLog.updateMany({
        where: { projectId },
        data: {
            status,
            reviewerId: reviewerId === 'system' ? null : reviewerId,
            feedback: feedback ?? null,
            decidedAt: new Date(),
        },
    });
}

/**
 * Export activities untuk Temporal workflow.
 */
export const reviewActivities: ReviewActivities = {
    runCanonCheckFinal,
    runSafetyReview,
    createSafetyReviewLogs,
    updateSafetyReviewLogs,
};