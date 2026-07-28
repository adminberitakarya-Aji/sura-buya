import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const REVIEW_DECISIONS = ['APPROVE', 'REQUEST_CHANGES', 'REJECT'] as const;

const createReviewSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  feedback: z.string().max(4000).optional(),
  annotations: z.record(z.unknown()).optional(),
});

/** Maps a review decision to the resulting Scene status. */
const DECISION_TO_SCENE_STATUS = {
  APPROVE: 'APPROVED',
  REQUEST_CHANGES: 'GENERATED',
  REJECT: 'REJECTED',
} as const;

interface RouteParams {
  params: { universeId: string; episodeId: string; sceneId: string };
}

async function findScopedScene(universeId: string, episodeId: string, sceneId: string) {
  return prisma.scene.findFirst({
    where: { id: sceneId, episodeId, episode: { universeId } },
  });
}

/** GET /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId/reviews */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const scene = await findScopedScene(params.universeId, params.episodeId, params.sceneId);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const reviews = await prisma.review.findMany({
      where: { sceneId: scene.id },
      orderBy: { createdAt: 'desc' },
      include: { reviewer: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/universes/:universeId/episodes/:episodeId/scenes/:sceneId/reviews */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'review:write');

    const scene = await findScopedScene(params.universeId, params.episodeId, params.sceneId);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const body = await req.json();
    const { decision, feedback, annotations } = createReviewSchema.parse(body);

    const [review, updatedScene] = await prisma.$transaction([
      prisma.review.create({
        data: {
          sceneId: scene.id,
          reviewerId: userId,
          decision,
          feedback,
          annotations: annotations ? (annotations as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      }),
      prisma.scene.update({
        where: { id: scene.id },
        data: { status: DECISION_TO_SCENE_STATUS[decision] },
      }),
    ]);

    // If every scene in the episode is now APPROVED, bump the episode too.
    // If review activity just started, move the episode out of PLANNING/GENERATING into REVIEW.
    const episode = await prisma.episode.findUniqueOrThrow({
      where: { id: params.episodeId },
      include: { scenes: { select: { status: true } } },
    });

    const allApproved =
      episode.scenes.length > 0 &&
      episode.scenes.every((s: { status: string }) => s.status === 'APPROVED');

    if (allApproved && !['APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(episode.status)) {
      await prisma.episode.update({ where: { id: episode.id }, data: { status: 'APPROVED' } });
    } else if (['PLANNING', 'GENERATING'].includes(episode.status)) {
      await prisma.episode.update({ where: { id: episode.id }, data: { status: 'REVIEW' } });
    }

    return NextResponse.json({ review, scene: updatedScene }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
