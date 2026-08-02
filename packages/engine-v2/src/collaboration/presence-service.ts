import { PrismaClient } from '@prisma/client';
import type { PresenceData } from './types.js';

export class PresenceService {
  constructor(private prisma: PrismaClient) {}

  async upsertPresence(data: Omit<PresenceData, 'id' | 'lastSeen'>): Promise<PresenceData> {
    const presence = await this.prisma.presence.upsert({
      where: {
        universeId_userId_sceneId: {
          universeId: data.universeId,
          userId: data.userId,
          sceneId: data.sceneId || '',
        },
      },
      create: {
        universeId: data.universeId,
        userId: data.userId,
        sceneId: data.sceneId,
        cursor: data.cursor as any,
        color: data.color,
        metadata: data.metadata as any,
      },
      update: {
        cursor: data.cursor as any,
        color: data.color,
        metadata: data.metadata as any,
        lastSeen: new Date(),
      },
    });

    return this.mapPresence(presence);
  }

  async getPresence(universeId: string, sceneId?: string): Promise<PresenceData[]> {
    const presences = await this.prisma.presence.findMany({
      where: {
        universeId,
        sceneId: sceneId || null,
        lastSeen: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    return presences.map(this.mapPresence);
  }

  async getUserPresence(universeId: string, userId: string, sceneId?: string): Promise<PresenceData | null> {
    const presence = await this.prisma.presence.findUnique({
      where: {
        universeId_userId_sceneId: {
          universeId,
          userId,
          sceneId: sceneId || '',
        },
      },
    });

    return presence ? this.mapPresence(presence) : null;
  }

  async removePresence(universeId: string, userId: string, sceneId?: string): Promise<boolean> {
    await this.prisma.presence.delete({
      where: {
        universeId_userId_sceneId: {
          universeId,
          userId,
          sceneId: sceneId || '',
        },
      },
    });
    return true;
  }

  async cleanupStalePresences(maxAgeMinutes: number = 10): Promise<number> {
    const result = await this.prisma.presence.deleteMany({
      where: {
        lastSeen: {
          lt: new Date(Date.now() - maxAgeMinutes * 60 * 1000),
        },
      },
    });
    return result.count;
  }

  private mapPresence(presence: Record<string, any>): PresenceData {
    return {
      id: presence['id'],
      universeId: presence['universeId'],
      userId: presence['userId'],
      sceneId: presence['sceneId'],
      cursor: presence['cursor'] as PresenceData['cursor'] | undefined,
      color: presence['color'],
      lastSeen: presence['lastSeen'],
      metadata: presence['metadata'] as Record<string, any> | undefined,
    };
  }
}