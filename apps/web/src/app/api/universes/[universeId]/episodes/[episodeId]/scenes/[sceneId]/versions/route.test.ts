import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const sceneFindFirstMock = vi.fn();
const sceneVersionFindManyMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scene: { findFirst: (...a: unknown[]) => sceneFindFirstMock(...a) },
    sceneVersion: { findMany: (...a: unknown[]) => sceneVersionFindManyMock(...a) },
  },
}));

import { GET } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1', sceneId: 'scene-1' } };

describe('GET /api/.../scenes/[sceneId]/versions', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    sceneFindFirstMock.mockReset();
    sceneVersionFindManyMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('VIEWER');
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the scene is not found', async () => {
    sceneFindFirstMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(404);
  });

  it('lists versions ascending (oldest first) for the diff picker', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1' });
    sceneVersionFindManyMock.mockResolvedValue([
      { version: 1, content: 'draft 1' },
      { version: 2, content: 'draft 2' },
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(json.versions).toHaveLength(2);
    expect(sceneVersionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sceneId: 'scene-1' }, orderBy: { version: 'asc' } })
    );
  });
});
