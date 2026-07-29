import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const sceneFindManyMock = vi.fn();
const sceneCreateMock = vi.fn();
const episodeFindFirstOrThrowMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scene: {
      findMany: (...a: unknown[]) => sceneFindManyMock(...a),
      create: (...a: unknown[]) => sceneCreateMock(...a),
    },
    episode: {
      findFirstOrThrow: (...a: unknown[]) => episodeFindFirstOrThrowMock(...a),
    },
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1' } };

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/episodes/ep-1/scenes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/episodes/[episodeId]/scenes', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    sceneFindManyMock.mockReset();
    sceneCreateMock.mockReset();
    episodeFindFirstOrThrowMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    episodeFindFirstOrThrowMock.mockResolvedValue({ id: 'ep-1' });
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('GET 404s when the episode does not belong to the universe', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    episodeFindFirstOrThrowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'P2025' })
    );
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(404);
  });

  it('GET lists scenes ordered by sceneNumber', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    sceneFindManyMock.mockResolvedValue([{ id: 'scene-1', sceneNumber: 1 }]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(json.scenes).toHaveLength(1);
    expect(sceneFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { episodeId: 'ep-1' }, orderBy: { sceneNumber: 'asc' } })
    );
  });

  it('POST rejects a non-positive sceneNumber', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(makePostRequest({ sceneNumber: 0, premise: 'x' }), params);
    expect(res.status).toBe(400);
  });

  it('POST defaults characters to an empty array', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    sceneCreateMock.mockResolvedValue({ id: 'scene-1' });
    await POST(makePostRequest({ sceneNumber: 1, premise: 'Pembuka cerita.' }), params);
    expect(sceneCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ characters: [] }) })
    );
  });

  it('POST scopes the new scene to episodeId from the URL, not the body', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    sceneCreateMock.mockResolvedValue({ id: 'scene-1' });
    await POST(makePostRequest({ sceneNumber: 1, premise: 'x' }), params);
    expect(sceneCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ episodeId: 'ep-1' }) })
    );
  });

  it('POST returns 403 for a VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest({ sceneNumber: 1, premise: 'x' }), params);
    expect(res.status).toBe(403);
  });
});
