import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateCommentSchema = z.object({
  content: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).optional(),
  type: z.enum(['GENERAL', 'SUGGESTION', 'QUESTION']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ universeId: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { universeId, commentId } = await params;
    const body = await request.json();
    const validated = updateCommentSchema.parse(body);

    // Check universe membership
    const membership = await prisma.universeMember.findUnique({
      where: { userId_universeId: { userId: session.user.id, universeId } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get comment and verify ownership
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existingComment || existingComment.universeId !== universeId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only author or universe owner can update
    if (existingComment.authorId !== session.user.id && membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: validated.content,
        status: validated.status,
        type: validated.type,
        resolvedAt: validated.status === 'RESOLVED' ? new Date() : existingComment.resolvedAt,
        resolvedById: validated.status === 'RESOLVED' ? session.user.id : existingComment.resolvedById,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
        replies: { include: { author: { select: { id: true, name: true, email: true, image: true } } } },
      },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ universeId: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { universeId, commentId } = await params;

    // Check universe membership
    const membership = await prisma.universeMember.findUnique({
      where: { userId_universeId: { userId: session.user.id, universeId } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get comment and verify ownership
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existingComment || existingComment.universeId !== universeId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only author or universe owner can delete
    if (existingComment.authorId !== session.user.id && membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}