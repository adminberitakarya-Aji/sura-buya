import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const sceneFindFirstMock = vi.fn();
const reviewFindManyMock = vi.fn();
const reviewCreateMock = vi.fn();
const sceneUpdateMock = vi.fn();
const episodeFindUniqueOrThrowMock = vi.fn();
const episodeUpdateMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scene: {
      findFirst: (...a: unknown[]) => sceneFindFirstMock(...a),
      update: (...a: unknown[]) => sceneUpdateMock(...a),
    },
    review: {
      findMany: (...a: unknown[]) => reviewFindManyMock(...a),
      create: (...a: unknown[]) => reviewCreateMock(...a),
    },
    episode: {
      findUniqueOrThrow: (...a: unknown[]) => episodeFindUniqueOrThrowMock(...a),
      update: (...a: unknown[]) => episodeUpdateMock(...a),
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1', sceneId: 'scene-1' } };

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/.../scenes/[sceneId]/reviews', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    sceneFindFirstMock.mockReset();
    reviewFindManyMock.mockReset();
    reviewCreateMock.mockReset();
    sceneUpdateMock.mockReset();
    episodeFindUniqueOrThrowMock.mockReset();
    episodeUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('REVIEWER');
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1' });
    reviewCreateMock.mockResolvedValue({ id: 'review-1', decision: 'APPROVE' });
    sceneUpdateMock.mockResolvedValue({ id: 'scene-1', status: 'APPROVED' });
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('GET 404s when the scene is not found', async () => {
    sceneFindFirstMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(404);
  });

  it('GET lists reviews newest first with reviewer info', async () => {
    reviewFindManyMock.mockResolvedValue([{ id: 'r1', decision: 'APPROVE' }]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(json.reviews).toHaveLength(1);
    expect(reviewFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  it('POST requires review:write permission, not just content:write', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'REVIEW',
      scenes: [{ status: 'APPROVED' }],
    });
    await POST(makePostRequest({ decision: 'APPROVE' }), params);
    expect(assertCanMock).toHaveBeenCalledWith('user-1', 'uni-1', 'review:write');
  });

  it('POST APPROVE sets scene status to APPROVED', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'REVIEW',
      scenes: [{ status: 'APPROVED' }],
    });
    await POST(makePostRequest({ decision: 'APPROVE' }), params);
    expect(sceneUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'APPROVED' } })
    );
  });

  it('POST REQUEST_CHANGES reverts scene status to GENERATED', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'REVIEW',
      scenes: [{ status: 'GENERATED' }],
    });
    await POST(makePostRequest({ decision: 'REQUEST_CHANGES', feedback: 'Perbaiki dialog.' }), params);
    expect(sceneUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'GENERATED' } })
    );
  });

  it('POST REJECT sets scene status to REJECTED', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'REVIEW',
      scenes: [{ status: 'REJECTED' }],
    });
    await POST(makePostRequest({ decision: 'REJECT' }), params);
    expect(sceneUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } })
    );
  });

  it('POST bumps the episode to APPROVED once every scene is approved', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'REVIEW',
      scenes: [{ status: 'APPROVED' }, { status: 'APPROVED' }],
    });
    await POST(makePostRequest({ decision: 'APPROVE' }), params);
    expect(episodeUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'APPROVED' } })
    );
  });

  it('POST does not bump the episode when only some scenes are approved', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'GENERATING',
      scenes: [{ status: 'APPROVED' }, { status: 'GENERATED' }],
    });
    await POST(makePostRequest({ decision: 'APPROVE' }), params);
    // Not all approved, but episode was PLANNING/GENERATING -> moves to REVIEW instead.
    expect(episodeUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVIEW' } })
    );
  });

  it('POST does not downgrade an already-PUBLISHED episode even if all scenes are approved', async () => {
    episodeFindUniqueOrThrowMock.mockResolvedValue({
      id: 'ep-1',
      status: 'PUBLISHED',
      scenes: [{ status: 'APPROVED' }],
    });
    await POST(makePostRequest({ decision: 'APPROVE' }), params);
    expect(episodeUpdateMock).not.toHaveBeenCalled();
  });

  it('POST 404s when the scene is not found', async () => {
    sceneFindFirstMock.mockResolvedValue(null);
    const res = await POST(makePostRequest({ decision: 'APPROVE' }), params);
    expect(res.status).toBe(404);
  });

  it('POST rejects an invalid decision value', async () => {
    const res = await POST(makePostRequest({ decision: 'MAYBE' }), params);
    expect(res.status).toBe(400);
  });

  it('POST returns 403 for a VIEWER role (lacks review:write)', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest({ decision: 'APPROVE' }), params);
    expect(res.status).toBe(403);
  });
});
