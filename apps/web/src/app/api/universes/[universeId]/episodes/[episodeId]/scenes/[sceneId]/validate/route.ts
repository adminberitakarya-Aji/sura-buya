import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { runJob } from '@/lib/jobs';
import { buildValidationContext } from '@/lib/engine/validation-context';
import { buildCanonValidatorForUniverse, buildJudgingCriteria } from '@/lib/engine/validator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface RouteParams {
  params: { universeId: string; episodeId: string; sceneId: string };
}

/**
 * POST /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId/validate
 *
 * Runs the canon validator (deterministic rules + optional LLM judge)
 * against the scene's generated text and persists the report. Not
 * streamed — validation is a single bounded call, so a plain JSON
 * response (backed by a GenerationJob for the audit trail) is enough.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const scene = await prisma.scene.findFirst({
      where: {
        id: params.sceneId,
        episodeId: params.episodeId,
        episode: { universeId: params.universeId },
      },
    });

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    if (!scene.generatedText) {
      return NextResponse.json(
        { error: 'Scene belum punya konten untuk divalidasi. Generate scene ini dulu.' },
        { status: 400 }
      );
    }

    const { job, result, error } = await runJob(
      {
        universeId: params.universeId,
        userId,
        type: 'CANON_VALIDATION',
        input: { episodeId: params.episodeId, sceneId: params.sceneId },
      },
      async (report) => {
        await report(10, 'Memuat context universe & canon rules');

        const [context, { validator, dbRules }] = await Promise.all([
          buildValidationContext(params.universeId, params.episodeId, params.sceneId),
          buildCanonValidatorForUniverse(params.universeId),
        ]);

        await report(40, 'Menjalankan rule-based checks & LLM judge');

        const validation = await validator.validate(scene.generatedText as string, context, {
          judgingCriteria: buildJudgingCriteria(dbRules),
        });

        await report(80, 'Menyimpan hasil validasi');

        const updatedScene = await prisma.scene.update({
          where: { id: scene.id },
          data: {
            status: 'VALIDATED',
            validationReport: validation as unknown as Prisma.InputJsonValue,
          },
        });

        return { sceneId: updatedScene.id, validation };
      }
    );

    if (error) {
      return NextResponse.json({ error, job }, { status: 502 });
    }

    return NextResponse.json({ job, validation: result?.validation });
  } catch (error) {
    return errorResponse(error);
  }
}
