import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
const updateMock = vi.fn();
const findUniqueMock = vi.fn();
const findUniqueOrThrowMock = vi.fn();
const findManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    generationJob: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import {
  createJob,
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
  cancelJob,
  getJob,
  listJobs,
  runJob,
} from './jobs';

const baseJob = {
  id: 'job-1',
  universeId: 'uni-1',
  userId: 'user-1',
  type: 'SCENE_GENERATION' as const,
  status: 'PENDING' as const,
  progress: 0,
};

describe('jobs service', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    findUniqueMock.mockReset();
    findUniqueOrThrowMock.mockReset();
    findManyMock.mockReset();
  });

  it('createJob creates a PENDING job with the given input', async () => {
    createMock.mockResolvedValue({ ...baseJob });
    await createJob({
      universeId: 'uni-1',
      userId: 'user-1',
      type: 'SCENE_GENERATION',
      input: { sceneId: 'scene-1' },
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', universeId: 'uni-1' }),
      })
    );
  });

  it('startJob sets status RUNNING and a startedAt timestamp', async () => {
    updateMock.mockResolvedValue({ ...baseJob, status: 'RUNNING' });
    await startJob('job-1');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'RUNNING', startedAt: expect.any(Date) }),
      })
    );
  });

  it('updateJobProgress clamps progress between 0 and 100', async () => {
    updateMock.mockResolvedValue({ ...baseJob });
    await updateJobProgress('job-1', 150);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress: 100 }) })
    );

    await updateJobProgress('job-1', -20);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress: 0 }) })
    );
  });

  it('updateJobProgress rounds fractional progress', async () => {
    updateMock.mockResolvedValue({ ...baseJob });
    await updateJobProgress('job-1', 42.6, 'Menulis...');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress: 43, currentStep: 'Menulis...' }),
      })
    );
  });

  it('completeJob sets status COMPLETED, progress 100, and stores output', async () => {
    updateMock.mockResolvedValue({ ...baseJob, status: 'COMPLETED' });
    await completeJob('job-1', { sceneId: 'scene-1' });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          progress: 100,
          output: { sceneId: 'scene-1' },
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it('failJob sets status FAILED with the error message', async () => {
    updateMock.mockResolvedValue({ ...baseJob, status: 'FAILED' });
    await failJob('job-1', 'Provider timeout');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', error: 'Provider timeout' }),
      })
    );
  });

  it('cancelJob marks a PENDING/RUNNING job as CANCELLED', async () => {
    findUniqueOrThrowMock.mockResolvedValue({ ...baseJob, status: 'RUNNING' });
    updateMock.mockResolvedValue({ ...baseJob, status: 'CANCELLED' });
    const result = await cancelJob('job-1');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) })
    );
    expect(result?.status).toBe('CANCELLED');
  });

  it('cancelJob is a no-op for an already-completed job', async () => {
    findUniqueOrThrowMock.mockResolvedValue({ ...baseJob, status: 'COMPLETED' });
    const result = await cancelJob('job-1');
    expect(updateMock).not.toHaveBeenCalled();
    expect(result?.status).toBe('COMPLETED');
  });

  it('cancelJob returns null if the job does not exist', async () => {
    findUniqueOrThrowMock.mockRejectedValue(new Error('not found'));
    const result = await cancelJob('missing-job');
    expect(result).toBeNull();
  });

  it('getJob scopes the lookup to the given universeId', async () => {
    findUniqueMock.mockResolvedValue({ ...baseJob });
    await getJob('uni-1', 'job-1');
    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', universeId: 'uni-1' } })
    );
  });

  it('listJobs applies optional type/status filters and defaults to 50', async () => {
    findManyMock.mockResolvedValue([]);
    await listJobs({ universeId: 'uni-1', type: 'CANON_VALIDATION', status: 'COMPLETED' });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { universeId: 'uni-1', type: 'CANON_VALIDATION', status: 'COMPLETED' },
        take: 50,
      })
    );
  });

  describe('runJob', () => {
    it('creates, starts, and completes a job around successful work', async () => {
      createMock.mockResolvedValue({ ...baseJob });
      updateMock.mockImplementation((args: { data: Record<string, unknown> }) => ({
        ...baseJob,
        ...args.data,
      }));

      const { job, result, error } = await runJob(
        { universeId: 'uni-1', userId: 'user-1', type: 'CANON_VALIDATION', input: {} },
        async (report) => {
          await report(50, 'halfway');
          return { ok: true };
        }
      );

      expect(error).toBeUndefined();
      expect(result).toEqual({ ok: true });
      expect(job.status).toBe('COMPLETED');
      // startJob + progress report + completeJob = at least 3 update calls
      expect(updateMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('fails the job and returns the error message when work throws', async () => {
      createMock.mockResolvedValue({ ...baseJob });
      updateMock.mockImplementation((args: { data: Record<string, unknown> }) => ({
        ...baseJob,
        ...args.data,
      }));

      const { job, result, error } = await runJob(
        { universeId: 'uni-1', userId: 'user-1', type: 'CANON_VALIDATION', input: {} },
        async () => {
          throw new Error('boom');
        }
      );

      expect(result).toBeUndefined();
      expect(error).toBe('boom');
      expect(job.status).toBe('FAILED');
    });
  });
});
