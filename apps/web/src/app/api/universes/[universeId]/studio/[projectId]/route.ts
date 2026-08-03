/**
 * VF-2.6 — Studio Project Detail API Routes
 *
 * GET    /api/universes/[universeId]/studio/[projectId] — get project
 * PATCH  /api/universes/[universeId]/studio/[projectId] — update project
 * DELETE /api/universes/[universeId]/studio/[projectId] — delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  script: z.string().optional(),
  storyboard: z.array(z.any()).optional(),
  beatSheet: z.any().optional(),
  status: z.enum(['DRAFT', 'SCRIPTED', 'STORYBOARDED', 'GENERATING', 'RENDERED', 'REVIEWED', 'EXPORTED']).optional(),
  settings: z.record(z.any()).optional(),
});

interface RouteParams {
  params: { universeId: string; projectId: string };
}

/** GET /api/universes/:universeId/studio/:projectId */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const { prisma } = await import('@/lib/prisma');
    const project = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      include: {
        character: {
          select: { id: true, displayName: true, characterId: true, role: true },
        },
        series: {
          select: { id: true, title: true },
        },
      },
    });

    if (!project || project.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/universes/:universeId/studio/:projectId */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    const { prisma } = await import('@/lib/prisma');

    // Verify project exists in this universe
    const existing = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      select: { universeId: true },
    });

    if (!existing || existing.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = await prisma.videoProject.update({
      where: { id: params.projectId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.script !== undefined && { script: data.script }),
        ...(data.storyboard !== undefined && { storyboard: data.storyboard }),
        ...(data.beatSheet !== undefined && { beatSheet: data.beatSheet }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.settings !== undefined && { settings: data.settings }),
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/studio/:projectId */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const { prisma } = await import('@/lib/prisma');

    // Verify project exists in this universe
    const existing = await prisma.videoProject.findUnique({
      where: { id: params.projectId },
      select: { universeId: true },
    });

    if (!existing || existing.universeId !== params.universeId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.videoProject.delete({
      where: { id: params.projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}