import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const episodeFindFirstMock = vi.fn();
const sceneCreateMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    episode: { findFirst: (...a: unknown[]) => episodeFindFirstMock(...a) },
    scene: { create: (...a: unknown[]) => sceneCreateMock(...a) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import { POST } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1' } };

function makeRequest() {
  return new NextRequest('http://localhost/x', { method: 'POST' });
}

describe('POST /api/.../episodes/[episodeId]/scenes/from-plan', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    episodeFindFirstMock.mockReset();
    sceneCreateMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
    sceneCreateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: `scene-${data.sceneNumber}`, ...data })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the episode is not found', async () => {
    episodeFindFirstMock.mockResolvedValue(null);
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(404);
  });

  it('returns 400 when the episode has no AI plan yet', async () => {
    episodeFindFirstMock.mockResolvedValue({ id: 'ep-1', plan: null, scenes: [] });
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(400);
  });

  it('returns 400 when plan.scenes is an empty array', async () => {
    episodeFindFirstMock.mockResolvedValue({ id: 'ep-1', plan: { scenes: [] }, scenes: [] });
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(400);
  });

  it('creates a scene for every plan scene when none exist yet', async () => {
    episodeFindFirstMock.mockResolvedValue({
      id: 'ep-1',
      scenes: [],
      plan: {
        scenes: [
          { number: 1, location: 'pantai', characters: ['suro'], summary: 'Pembuka.' },
          { number: 2, location: 'hutan', characters: ['suro', 'buya'], summary: 'Konflik.' },
        ],
      },
    });

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.created).toBe(2);
    expect(sceneCreateMock).toHaveBeenCalledTimes(2);
  });

  it('skips scene numbers that already have a Scene row', async () => {
    episodeFindFirstMock.mockResolvedValue({
      id: 'ep-1',
      scenes: [{ sceneNumber: 1 }],
      plan: {
        scenes: [
          { number: 1, summary: 'Sudah ada.' },
          { number: 2, summary: 'Belum ada.' },
        ],
      },
    });

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(json.created).toBe(1);
    expect(sceneCreateMock).toHaveBeenCalledTimes(1);
    expect(sceneCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sceneNumber: 2 }) })
    );
  });

  it('returns created:0 without erroring when every scene number already exists', async () => {
    episodeFindFirstMock.mockResolvedValue({
      id: 'ep-1',
      scenes: [{ sceneNumber: 1 }],
      plan: { scenes: [{ number: 1, summary: 'x' }] },
    });

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.created).toBe(0);
    expect(sceneCreateMock).not.toHaveBeenCalled();
  });

  it('falls back to a generic premise when the plan scene has no summary', async () => {
    episodeFindFirstMock.mockResolvedValue({
      id: 'ep-1',
      scenes: [],
      plan: { scenes: [{ number: 1 }] },
    });

    await POST(makeRequest(), params);

    expect(sceneCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ premise: 'Scene 1', characters: [] }) })
    );
  });

  it('returns 403 when the caller lacks content:write', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(403);
  });
});
