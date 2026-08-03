/**
 * VF-2.6 — Script Generation API Route
 *
 * POST /api/universes/[universeId]/studio/[projectId]/script
 *
 * Calls engine-v2 generateScript() (VF-2.2) with VideoCharacterContext (VF-2.0),
 * beat sheet (VF-2.3), and optional series context for continuity.
 *
 * Bridge layer: converts Prisma Character + CharacterAsset → VideoCharacterContext
 * before calling engine-v2 (engine-v2 never accesses Prisma directly).
 *
 * AI provider pattern: same as parse-persona route (VF-1.8) — build provider
 * from AIConfig DB or fallback to inline mock provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import {
  generateScript,
  type ScriptGeneratorInput,
  type SeriesContext,
} from '@suro-buya/engine-v2';
import type { AIProvider, AIProviderOptions, AIResponse } from '@suro-buya/engine-v2';
import type { VideoCharacterContext, ContentRating } from '@suro-buya/shared';

const generateScriptSchema = z.object({
  storyIdea: z.string().min(5).max(5000),
});

interface RouteParams {
  params: { universeId: string; projectId: string };
}

/**
 * Build VideoCharacterContext from Prisma Character + CharacterAsset.
 * This is the bridge layer — engine-v2 never accesses Prisma directly.
 */
async function buildVideoCharacterContext(
  prisma: any,
  characterId: string,
  universeId: string,
): Promise<{ context: VideoCharacterContext; contentRating: ContentRating; audienceProfile: string | null }> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      characterAsset: true,
      universe: {
        select: { contentRating: true, audienceProfile: true },
      },
    },
  });

  if (!character || character.universeId !== universeId) {
    throw new Error('Character not found in this universe');
  }

  const metadata = (character.metadata ?? {}) as Record<string, unknown>;
  const context: VideoCharacterContext = {
    id: character.id,
    characterId: character.characterId,
    displayName: character.displayName,
    role: character.role,
    description: character.description ?? '',
    coreTraits: character.coreTraits,
    coreWeakness: character.coreWeakness,
    voiceGuide: character.voiceGuide ?? '',
    metadata: {
      species: typeof metadata.species === 'string' ? metadata.species : '',
      ageDescriptor: typeof metadata.ageDescriptor === 'string' ? metadata.ageDescriptor : '',
      motivation: typeof metadata.motivation === 'string' ? metadata.motivation : null,
      visualDescription: typeof metadata.visualDescription === 'string' ? metadata.visualDescription : '',
      personaSource: metadata.personaSource === 'manual' ? 'manual' : 'ai-parsed',
    },
    visualProfile: character.characterAsset
      ? {
          referenceImages: character.characterAsset.referenceImages,
          styleTags: [],
        }
      : undefined,
  };

  return {
    context,
    contentRating: character.universe.contentRating as ContentRating,
    audienceProfile: character.universe.audienceProfile,
  };
}

/**
 * Build SeriesContext from previous episodes if project is part of a series.
 */
async function buildSeriesContext(
  prisma: any,
  projectId: string,
): Promise<SeriesContext | undefined> {
  const project = await prisma.videoProject.findUnique({
    where: { id: projectId },
    select: { seriesId: true, episodeOrder: true },
  });

  if (!project?.seriesId || !project.episodeOrder) {
    return undefined;
  }

  const previousProjects = await prisma.videoProject.findMany({
    where: {
      seriesId: project.seriesId,
      episodeOrder: { lt: project.episodeOrder },
    },
    select: {
      episodeOrder: true,
      title: true,
      script: true,
    },
    orderBy: { episodeOrder: 'asc' },
  });

  return {
    seriesId: project.seriesId,
    episodeOrder: project.episodeOrder,
    previousEpisodes: previousProjects.map((p: any) => ({
      episodeOrder: p.episodeOrder,
      title: p.title,
      script: p.script,
      summary: p.script.substring(0, 200) + '...',
    })),
  };
}

/**
 * Build AI provider — same pattern as parse-persona route (VF-1.8).
 * Uses AIConfig from DB if available, falls back to inline mock provider.
 */
function buildScriptAIProvider(
  apiKey: string | undefined,
  providerName?: string,
  modelName?: string,
): AIProvider {
  const name = providerName ?? 'mock-anthropic';
  const model = modelName ?? 'mock-model';

  if (!apiKey || apiKey.trim() === '') {
    // Mock provider — returns a sample script for development/testing
    return {
      name: `mock-${name}`,
      version: '0.0.0',
      isAvailable: async () => true,
      getModels: async () => [model],
      generateStream: async function* () { yield ''; },
      generate: async (_prompt: string, _opts: AIProviderOptions): Promise<AIResponse> => {
        return {
          content: `Judul: Petualangan Baru

[Beat 1: Hook]
[Karakter berdiri di tepi pantai, memandang laut yang luas]
KARAKTER: "Hari ini adalah hari yang sempurna untuk petualangan!"

[Beat 2: Conflict]
[Tiba-tiba awan gelap muncul, ombak mulai besar]
KARAKTER: "Aku harus tetap berani meski takut!"

[Beat 3: Punchline]
[Matahari kembali bersinar, karakter tersenyum]
KARAKTER: "Setiap badai pasti berlalu, dan petualangan itu sendiri yang berharga!"`,
          model,
          provider: name,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latency: 0,
          finishReason: 'stop',
        };
      },
    };
  }

  // Real provider — Anthropic Claude (same pattern as parse-persona route)
  return {
    name,
    version: '1.0.0',
    isAvailable: async () => true,
    getModels: async () => [model],
    generateStream: async function* () { yield ''; },
    generate: async (prompt: string, opts: AIProviderOptions): Promise<AIResponse> => {
      const startMs = Date.now();
      const messages: { role: 'user' | 'assistant'; content: string }[] = [];
      messages.push({ role: 'user', content: prompt });

      const requestBody: Record<string, unknown> = {
        model: opts.model ?? model,
        max_tokens: opts.maxTokens ?? 1024,
        messages,
      };
      if (opts.systemPrompt) {
        requestBody['system'] = opts.systemPrompt;
      }
      if (opts.temperature !== undefined) {
        requestBody['temperature'] = opts.temperature;
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
      }

      const data = await resp.json() as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };

      const content = data.content?.find((c) => c.type === 'text')?.text ?? '';
      const usage = data.usage ?? {};

      return {
        content,
        model: opts.model ?? model,
        provider: name,
        usage: {
          promptTokens: usage.input_tokens ?? 0,
          completionTokens: usage.output_tokens ?? 0,
          totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        },
        latency: Date.now() - startMs,
        finishReason: (
          ['stop', 'length', 'content_filter', 'error', 'unknown'].includes(data.stop_reason ?? '')
            ? data.stop_reason
            : 'stop'
        ) as AIResponse['finishReason'],
      };
    },
  };
}

/** POST /api/universes/:universeId/studio/:projectId/script */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = generateScriptSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // Get project
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build VideoCharacterContext (bridge layer)
    const { context: character, contentRating, audienceProfile } = await buildVideoCharacterContext(
      prisma,
      project.characterId,
      params.universeId,
    );

    // Build series context if part of a series
    const seriesContext = await buildSeriesContext(prisma, params.projectId);

    // Get target duration from project settings
    const settings = (project.settings ?? {}) as Record<string, unknown>;
    const targetDuration = (settings.targetDuration as 15 | 30 | 60) ?? 15;

    // Build script generator input
    const scriptInput: ScriptGeneratorInput = {
      character,
      storyIdea: data.storyIdea,
      targetDuration,
      contentRating,
      audienceProfile: audienceProfile ?? undefined,
      seriesContext,
    };

    // Build AI provider from AIConfig DB or fallback to mock
    const aiConfig = await prisma.aIConfig.findFirst({
      where: {
        universeId: params.universeId,
        task: 'CREATIVE_GENERATION',
        isDefault: true,
      },
      select: { provider: true, model: true, parameters: true, apiKeyEncrypted: true },
    });

    let apiKey: string | undefined;
    if (aiConfig?.apiKeyEncrypted) {
      try {
        const { decryptSecret } = await import('@/lib/encryption');
        apiKey = decryptSecret(aiConfig.apiKeyEncrypted);
      } catch {
        apiKey = undefined;
      }
    }

    const provider = buildScriptAIProvider(
      apiKey,
      aiConfig?.provider,
      aiConfig?.model,
    );

    // Generate script
    const result = await generateScript(scriptInput, provider);

    // Save script to project
    const updatedProject = await prisma.videoProject.update({
      where: { id: params.projectId },
      data: {
        script: result.script,
        beatSheet: result.beatSheet as any,
        status: 'SCRIPTED',
        title: result.title,
      },
    });

    return NextResponse.json({
      project: updatedProject,
      script: result.script,
      title: result.title,
      estimatedDuration: result.estimatedDuration,
      beatCount: result.beatCount,
      beatSheet: result.beatSheet,
      metadata: result.metadata,
    });
  } catch (error) {
    return errorResponse(error);
  }
}