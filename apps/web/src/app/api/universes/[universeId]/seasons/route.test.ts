import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const findManyMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...args: unknown[]) => assertCanMock(...args) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    season: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1' } };

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/seasons', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/seasons', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findManyMock.mockReset();
    createMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('GET lists seasons ordered by seasonNumber with episode counts', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findManyMock.mockResolvedValue([{ id: 's1', seasonNumber: 1, title: 'Jawa Timur' }]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.seasons).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { universeId: 'uni-1' },
        orderBy: { seasonNumber: 'asc' },
        include: { _count: { select: { episodes: true } } },
      })
    );
  });

  it('POST rejects a missing title', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(makePostRequest({ seasonNumber: 1 }), params);
    expect(res.status).toBe(400);
  });

  it('POST rejects a non-positive seasonNumber', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(makePostRequest({ seasonNumber: 0, title: 'Season 0' }), params);
    expect(res.status).toBe(400);
  });

  it('POST defaults episodeCount to 10 when omitted', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    createMock.mockResolvedValue({ id: 's1', seasonNumber: 1, title: 'Jawa Timur' });
    const res = await POST(makePostRequest({ seasonNumber: 1, title: 'Jawa Timur' }), params);
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ episodeCount: 10 }) })
    );
  });

  it('POST scopes the new season to the universe from the URL', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    createMock.mockResolvedValue({ id: 's1' });
    await POST(makePostRequest({ seasonNumber: 2, title: 'Bali' }), params);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ universeId: 'uni-1' }) })
    );
  });

  it('POST returns 403 when the caller lacks content:write', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest({ seasonNumber: 1, title: 'X' }), params);
    expect(res.status).toBe(403);
  });
});
