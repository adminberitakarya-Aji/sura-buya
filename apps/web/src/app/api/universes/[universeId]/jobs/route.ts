import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { listJobs, getJob, cancelJob } from '@/lib/jobs';

const JOB_TYPES = [
  'SCENE_GENERATION',
  'EPISODE_PLANNING',
  'SEASON_PLANNING',
  'CANON_VALIDATION',
  'EMBEDDING_INDEX',
] as const;

const JOB_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

const listQuerySchema = z.object({
  type: z.enum(JOB_TYPES).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  jobId: z.string().optional(),
});

interface RouteParams {
  params: { universeId: string };
}

/**
 * GET /api/universes/:universeId/jobs           -> list recent jobs
 * GET /api/universes/:universeId/jobs?jobId=xyz  -> fetch a single job (for polling)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:read');

    const query = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

    if (query.jobId) {
      const job = await getJob(params.universeId, query.jobId);
      if (!job) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    const jobs = await listJobs({
      universeId: params.universeId,
      type: query.type,
      status: query.status,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    return errorResponse(error);
  }
}

const cancelSchema = z.object({ jobId: z.string().min(1) });

/** POST /api/universes/:universeId/jobs { jobId } -> cancel a running/pending job */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const { jobId } = cancelSchema.parse(body);

    // Ensure the job belongs to this universe before cancelling.
    await prisma.generationJob.findFirstOrThrow({
      where: { id: jobId, universeId: params.universeId },
      select: { id: true },
    });

    const job = await cancelJob(jobId);
    return NextResponse.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
