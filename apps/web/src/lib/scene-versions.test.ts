import { describe, it, expect, vi, beforeEach } from 'vitest';

const upsertMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    sceneVersion: {
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

import { snapshotSceneVersion } from './scene-versions';

describe('snapshotSceneVersion', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({});
  });

  it('upserts on the composite (sceneId, version) key', async () => {
    await snapshotSceneVersion('scene-1', 3, 'Scene content here');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sceneId_version: { sceneId: 'scene-1', version: 3 } },
      })
    );
  });

  it('creates with the given content when no snapshot exists yet', async () => {
    await snapshotSceneVersion('scene-1', 1, 'First draft');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { sceneId: 'scene-1', version: 1, content: 'First draft' },
      })
    );
  });

  it('is idempotent — the update branch is a no-op so re-snapshotting is safe', async () => {
    await snapshotSceneVersion('scene-1', 2, 'Second draft');
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });
});
