import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Get active presences (last 5 minutes)
    const presences = await prisma.presence.findMany({
      where: {
        universeId,
        sceneId,
        lastSeen: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({ presences });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}