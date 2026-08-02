import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createCommentSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['GENERAL', 'SUGGESTION', 'QUESTION']).default('GENERAL'),
  blockId: z.string().optional(),
  anchor: z.object({
    blockId: z.string(),
    offset: z.number(),
    length: z.number().optional(),
  }).optional(),
  parentId: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ universeId: string; sceneId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { universeId, sceneId } = await params;

    // Check universe membership
    const membership = await prisma.universeMember.findUnique({
      where: { userId_universeId: { userId: session.user.id, universeId } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get top-level comments with replies
    const comments = await prisma.comment.findMany({
      where: {
        universeId,
        sceneId,
        parentId: null,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
        replies: {
          include: {
            author: { select: { id: true, name: true, email: true, image: true } },
            replies: {
              include: { author: { select: { id: true, name: true, email: true, image: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ universeId: string; sceneId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { universeId, sceneId } = await params;
    const body = await request.json();
    const validated = createCommentSchema.parse(body);

    // Check universe membership
    const membership = await prisma.universeMember.findUnique({
      where: { userId_universeId: { userId: session.user.id, universeId } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify scene exists and belongs to universe
    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { universeId } },
    });
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        universeId,
        sceneId,
        blockId: validated.blockId,
        authorId: session.user.id,
        content: validated.content,
        type: validated.type,
        status: 'OPEN',
        parentId: validated.parentId,
        anchor: validated.anchor,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
        replies: true,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
