import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const sceneFindFirstMock = vi.fn();
const sceneUpdateMock = vi.fn();
const snapshotMock = vi.fn();

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
  },
}));

vi.mock('@/lib/scene-versions', () => ({
  snapshotSceneVersion: (...a: unknown[]) => snapshotMock(...a),
}));

import { PATCH } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1', sceneId: 'scene-1' } };

const sampleBlocks = [
  { id: 'b1', type: 'heading', text: 'INT. RUMAH - PAGI' },
  { id: 'b2', type: 'action', text: 'Suro bangun tidur.' },
  { id: 'b3', type: 'dialogue', character: 'SURO', line: 'Selamat pagi!' },
];

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/x', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('PATCH /api/.../scenes/[sceneId]/blocks', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    sceneFindFirstMock.mockReset();
    sceneUpdateMock.mockReset();
    snapshotMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ blocks: sampleBlocks }), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the scene is not found', async () => {
    sceneFindFirstMock.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ blocks: sampleBlocks }), params);
    expect(res.status).toBe(404);
  });

  it('rejects an empty blocks array', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: '' });
    const res = await PATCH(makeRequest({ blocks: [] }), params);
    expect(res.status).toBe(400);
  });

  it('rejects a block with an unknown type', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: '' });
    const res = await PATCH(makeRequest({ blocks: [{ id: 'b1', type: 'unknown', text: 'x' }] }), params);
    expect(res.status).toBe(400);
  });

  it('regenerates generatedText from blocks, bumps version, and snapshots when text changed', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: 'teks lama yang beda' });
    sceneUpdateMock.mockResolvedValue({ id: 'scene-1', version: 2 });

    const res = await PATCH(makeRequest({ blocks: sampleBlocks }), params);

    expect(res.status).toBe(200);
    expect(sceneUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: { increment: 1 },
          generatedText: expect.stringContaining('Suro bangun tidur.'),
        }),
      })
    );
    expect(snapshotMock).toHaveBeenCalledWith('scene-1', 2, expect.any(String));
  });

  it('does not bump version or snapshot when the regenerated text is identical', async () => {
    // blocksToText(sampleBlocks) is deterministic — precompute it to simulate "no real change".
    const { blocksToText } = await import('@/lib/engine/scene-output');
    const regenerated = blocksToText(sampleBlocks as never);

    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: regenerated });
    sceneUpdateMock.mockResolvedValue({ id: 'scene-1', version: 1 });

    await PATCH(makeRequest({ blocks: sampleBlocks }), params);

    expect(sceneUpdateMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ data: expect.objectContaining({ version: expect.anything() }) })
    );
    expect(snapshotMock).not.toHaveBeenCalled();
  });

  it('persists the raw blocks JSON alongside the flattened text', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: '' });
    sceneUpdateMock.mockResolvedValue({ id: 'scene-1', version: 2 });

    await PATCH(makeRequest({ blocks: sampleBlocks }), params);

    expect(sceneUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ blocks: sampleBlocks }) })
    );
  });

  it('returns 403 when the caller lacks content:write', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await PATCH(makeRequest({ blocks: sampleBlocks }), params);
    expect(res.status).toBe(403);
  });
});
