import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized } from '@/lib/api-helpers';
import { createJob, startJob, updateJobProgress, completeJob, failJob } from '@/lib/jobs';
import { buildGenerationContext, buildSceneGenerationInput } from '@/lib/engine/db-context';
import { buildOrchestratorForUniverse, UnconfiguredProviderError } from '@/lib/engine/orchestrator';
import { parseSceneOutput, formatSceneOutput, sceneOutputToBlocks } from '@/lib/engine/scene-output';
import { snapshotSceneVersion } from '@/lib/scene-versions';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const generateOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8000).optional(),
  specialInstructions: z.string().max(2000).optional(),
});

interface RouteParams {
  params: { universeId: string; episodeId: string; sceneId: string };
}

function sse(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * POST /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId/generate
 *
 * Streams generation progress as Server-Sent Events:
 *   event: chunk    { text }               -- incremental text as it's generated
 *   event: progress { progress, step }     -- coarse progress updates
 *   event: done     { jobId, scene }       -- final persisted scene
 *   event: error    { message }            -- generation or validation failure
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  try {
    await assertCan(userId, params.universeId, 'content:write');
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const scene = await prisma.scene.findFirst({
    where: {
      id: params.sceneId,
      episodeId: params.episodeId,
      episode: { universeId: params.universeId },
    },
  });

  if (!scene) {
    return new Response(JSON.stringify({ error: 'Scene not found' }), { status: 404 });
  }

  let bodyInput: z.infer<typeof generateOptionsSchema> = {};
  try {
    const raw = await req.json().catch(() => ({}));
    bodyInput = generateOptionsSchema.parse(raw ?? {});
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  // Fail fast (plain JSON, not SSE) if the universe has no AI provider configured yet.
  let orchestrator;
  try {
    orchestrator = await buildOrchestratorForUniverse(params.universeId);
  } catch (error) {
    if (error instanceof UnconfiguredProviderError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    throw error;
  }

  const job = await createJob({
    universeId: params.universeId,
    userId,
    type: 'SCENE_GENERATION',
    input: { episodeId: params.episodeId, sceneId: params.sceneId, ...bodyInput },
  });
  await startJob(job.id);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullContent = '';
      let closed = false;

      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      try {
        const [context, sceneInput] = await Promise.all([
          buildGenerationContext(params.universeId, params.episodeId, scene.sceneNumber),
          buildSceneGenerationInput(params.universeId, params.episodeId, params.sceneId),
        ]);

        if (bodyInput.specialInstructions) {
          sceneInput.specialInstructions = bodyInput.specialInstructions;
        }

        send('progress', { progress: 5, step: 'Menyiapkan konteks universe & karakter' });
        await updateJobProgress(job.id, 5, 'Menyiapkan konteks universe & karakter');

        let chunkCount = 0;
        for await (const event of orchestrator.streamSceneGeneration(sceneInput, context, {
          temperature: bodyInput.temperature,
          maxTokens: bodyInput.maxTokens,
        })) {
          if (!event.done) {
            fullContent += event.chunk;
            chunkCount += 1;
            send('chunk', { text: event.chunk });

            if (chunkCount % 8 === 0) {
              const progress = Math.min(90, 10 + chunkCount);
              send('progress', { progress, step: 'Menulis scene...' });
              await updateJobProgress(job.id, progress, 'Menulis scene...');
            }
            continue;
          }

          // Final event: parse structured output (if any) and persist the scene.
          const structured = parseSceneOutput(fullContent);
          const generatedText = structured ? formatSceneOutput(structured) : fullContent.trim();
          const blocks = structured ? sceneOutputToBlocks(structured) : undefined;

          const updatedScene = await prisma.scene.update({
            where: { id: scene.id },
            data: {
              generatedText,
              ...(blocks ? { blocks: blocks as unknown as any } : {}),
              status: 'GENERATED',
              version: { increment: 1 },
              metadata: {
                model: event.metadata?.model,
                provider: event.metadata?.provider,
                tokensUsed: event.metadata?.tokensUsed,
                isFallback: event.metadata?.isFallback,
                structuredOutput: event.metadata?.structuredOutput ?? false,
                generatedAt: new Date().toISOString(),
              } as any,
            },
          });

          await snapshotSceneVersion(updatedScene.id, updatedScene.version, generatedText);

          await completeJob(job.id, {
            sceneId: updatedScene.id,
            model: event.metadata?.model ?? null,
            tokensUsed: event.metadata?.tokensUsed ?? 0,
          });

          send('done', { jobId: job.id, scene: updatedScene });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generasi scene gagal';
        await failJob(job.id, message).catch(() => undefined);
        send('error', { message, jobId: job.id });
      } finally {
        closed = true;
        controller.close();
      }
    },

    cancel() {
      // Client disconnected — best-effort mark the job failed/cancelled.
      failJob(job.id, 'Client disconnected').catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Job-Id': job.id,
    },
  });
}
