import { PrismaClient } from '@prisma/client';
import type { CommentData, CommentType, CommentStatus, CommentAnchor } from './types.js';

export class CommentService {
  constructor(private prisma: PrismaClient) {}

  async createComment(data: Omit<CommentData, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommentData> {
    const comment = await this.prisma.comment.create({
      data: {
        universeId: data.universeId,
        sceneId: data.sceneId,
        blockId: data.blockId,
        authorId: data.authorId,
        content: data.content,
        type: data.type,
        status: data.status,
        parentId: data.parentId,
        anchor: data.anchor as any,
      },
      include: {
        author: true,
        replies: true,
      },
    });

    return this.mapComment(comment);
  }

  async getComments(universeId: string, sceneId: string): Promise<CommentData[]> {
    const comments = await this.prisma.comment.findMany({
      where: {
        universeId,
        sceneId,
        parentId: null,
      },
      include: {
        author: true,
        replies: {
          include: {
            author: true,
            replies: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map(this.mapComment);
  }

  async getCommentById(commentId: string): Promise<CommentData | null> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: true,
        replies: {
          include: { author: true },
        },
      },
    });

    return comment ? this.mapComment(comment) : null;
  }

  async updateComment(
    commentId: string,
    data: Partial<Pick<CommentData, 'content' | 'status' | 'type'>>
  ): Promise<CommentData | null> {
    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: data.content,
        status: data.status,
        type: data.type,
        resolvedAt: data.status === 'RESOLVED' ? new Date() : null,
      },
      include: {
        author: true,
        replies: { include: { author: true } },
      },
    });

    return this.mapComment(comment);
  }

  async resolveComment(commentId: string, resolvedById: string): Promise<CommentData | null> {
    return this.updateComment(commentId, { status: 'RESOLVED' });
  }

  async dismissComment(commentId: string): Promise<CommentData | null> {
    return this.updateComment(commentId, { status: 'DISMISSED' });
  }

  async deleteComment(commentId: string): Promise<boolean> {
    await this.prisma.comment.delete({
      where: { id: commentId },
    });
    return true;
  }

  async addReply(
    parentId: string,
    data: Omit<CommentData, 'id' | 'createdAt' | 'updatedAt' | 'parentId'>
  ): Promise<CommentData> {
    return this.createComment({ ...data, parentId });
  }

  async getCommentsByBlock(universeId: string, sceneId: string, blockId: string): Promise<CommentData[]> {
    const comments = await this.prisma.comment.findMany({
      where: {
        universeId,
        sceneId,
        blockId,
        parentId: null,
      },
      include: {
        author: true,
        replies: { include: { author: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map(this.mapComment);
  }

  private mapComment(comment: Record<string, any>): CommentData {
    return {
      id: comment['id'],
      universeId: comment['universeId'],
      sceneId: comment['sceneId'],
      blockId: comment['blockId'],
      authorId: comment['authorId'],
      content: comment['content'],
      type: comment['type'] as CommentType,
      status: comment['status'] as CommentStatus,
      parentId: comment['parentId'],
      anchor: comment['anchor'] as CommentAnchor | undefined,
      createdAt: comment['createdAt'],
      updatedAt: comment['updatedAt'],
      resolvedAt: comment['resolvedAt'],
      resolvedById: comment['resolvedById'],
    };
  }
}
