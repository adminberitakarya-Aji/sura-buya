import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const findFirstOrThrowMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const snapshotMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scene: {
      findFirstOrThrow: (...a: unknown[]) => findFirstOrThrowMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      delete: (...a: unknown[]) => deleteMock(...a),
    },
  },
}));

vi.mock('@/lib/scene-versions', () => ({
  snapshotSceneVersion: (...a: unknown[]) => snapshotMock(...a),
}));

import { GET, PATCH, DELETE } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1', sceneId: 'scene-1' } };

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/.../scenes/[sceneId]', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findFirstOrThrowMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    snapshotMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('PATCH bumps version and snapshots history when generatedText changes', async () => {
    findFirstOrThrowMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Draf lama.', version: 1 });
    updateMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Draf baru.', version: 2 });

    const res = await PATCH(makePatchRequest({ generatedText: 'Draf baru.' }), params);

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    );
    expect(snapshotMock).toHaveBeenCalledWith('scene-1', 2, 'Draf baru.');
  });

  it('PATCH does not bump version or snapshot when generatedText is unchanged', async () => {
    findFirstOrThrowMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Sama saja.', version: 1 });
    updateMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Sama saja.', version: 1 });

    await PATCH(makePatchRequest({ generatedText: 'Sama saja.' }), params);

    expect(updateMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ data: expect.objectContaining({ version: expect.anything() }) })
    );
    expect(snapshotMock).not.toHaveBeenCalled();
  });

  it('PATCH does not bump version when bumpVersion:false is explicitly passed', async () => {
    findFirstOrThrowMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Draf lama.', version: 1 });
    updateMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Draf baru.', version: 1 });

    await PATCH(makePatchRequest({ generatedText: 'Draf baru.', bumpVersion: false }), params);

    expect(snapshotMock).not.toHaveBeenCalled();
  });

  it('PATCH does not touch version/snapshot when generatedText is absent from the body', async () => {
    findFirstOrThrowMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Draf lama.', version: 1 });
    updateMock.mockResolvedValue({ id: 'scene-1', premise: 'Premise baru' });

    await PATCH(makePatchRequest({ premise: 'Premise baru' }), params);

    expect(snapshotMock).not.toHaveBeenCalled();
  });

  it('PATCH 404s when the scene is not scoped to this episode/universe', async () => {
    findFirstOrThrowMock.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }));
    const res = await PATCH(makePatchRequest({ premise: 'x' }), params);
    expect(res.status).toBe(404);
  });

  it('DELETE removes the scene after scoping it to the universe/episode', async () => {
    findFirstOrThrowMock.mockResolvedValue({ id: 'scene-1' });
    deleteMock.mockResolvedValue({});
    const res = await DELETE(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'scene-1' } });
  });

  it('DELETE returns 403 when the caller lacks content:delete', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await DELETE(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(403);
  });
});
