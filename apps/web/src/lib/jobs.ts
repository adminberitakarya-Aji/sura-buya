import type { GenerationJob, JobStatus, JobType, Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * GenerationJob persistence + status tracking.
 *
 * A GenerationJob is the durable record behind any long-running engine
 * operation (scene generation, episode planning, canon validation, etc).
 * API routes create a job, run the work (optionally streaming progress to
 * the client via SSE at the same time), and update the job's status as
 * it moves through its lifecycle so clients can also poll for state if the
 * stream is interrupted (e.g. page refresh).
 *
 * Lifecycle: PENDING -> RUNNING -> COMPLETED | FAILED | CANCELLED
 */

export interface CreateJobInput {
  universeId: string;
  userId: string;
  type: JobType;
  input: Record<string, unknown>;
}

/** Create a new job in PENDING state. */
export async function createJob(data: CreateJobInput): Promise<GenerationJob> {
  return prisma.generationJob.create({
    data: {
      universeId: data.universeId,
      userId: data.userId,
      type: data.type,
      input: data.input as any,
      status: 'PENDING',
    },
  });
}

/** Mark a job as RUNNING and record the start time. */
export async function startJob(jobId: string): Promise<GenerationJob> {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });
}

/** Update progress (0-100) and an optional human-readable current step label. */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  currentStep?: string
): Promise<GenerationJob> {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      ...(currentStep !== undefined ? { currentStep } : {}),
    },
  });
}

/** Mark a job COMPLETED with its output payload. */
export async function completeJob(
  jobId: string,
  output: Record<string, unknown>
): Promise<GenerationJob> {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      output: output as any,
      completedAt: new Date(),
    },
  });
}

/** Mark a job FAILED with an error message. */
export async function failJob(jobId: string, error: string): Promise<GenerationJob> {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      error,
      completedAt: new Date(),
    },
  });
}

/** Mark a job CANCELLED. Safe to call even if the job already finished. */
export async function cancelJob(jobId: string): Promise<GenerationJob | null> {
  try {
    const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return job;
    }
    return await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  } catch {
    return null;
  }
}

/** Fetch a single job, scoped to a universe so cross-tenant reads are impossible. */
export async function getJob(universeId: string, jobId: string): Promise<GenerationJob | null> {
  return prisma.generationJob.findFirst({
    where: { id: jobId, universeId },
  });
}

export interface ListJobsFilter {
  universeId: string;
  type?: JobType;
  status?: JobStatus;
  limit?: number;
}

/** List recent jobs for a universe, newest first. */
export async function listJobs(filter: ListJobsFilter): Promise<GenerationJob[]> {
  return prisma.generationJob.findMany({
    where: {
      universeId: filter.universeId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
  });
}

/**
 * Run a job end-to-end: creates it, marks it RUNNING, invokes `work` (which
 * receives a progress reporter), then marks COMPLETED/FAILED based on the
 * outcome. Returns both the job record and the work result so callers can
 * stream progress separately (e.g. via SSE) while this handles persistence.
 */
export async function runJob<T extends Record<string, unknown>>(
  data: CreateJobInput,
  work: (report: (progress: number, step?: string) => Promise<void>) => Promise<T>
): Promise<{ job: GenerationJob; result?: T; error?: string }> {
  const job = await createJob(data);
  await startJob(job.id);

  const report = async (progress: number, step?: string) => {
    await updateJobProgress(job.id, progress, step);
  };

  try {
    const result = await work(report);
    const finished = await completeJob(job.id, result);
    return { job: finished, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    const finished = await failJob(job.id, message);
    return { job: finished, error: message };
  }
}
