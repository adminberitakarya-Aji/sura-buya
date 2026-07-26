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
    region: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1' } };

const validRegion = {
  regionId: 'jatim',
  name: 'Jawa Timur',
  description: 'Kampung pesisir tempat Suro dan Buya tinggal.',
};

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/regions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/regions', () => {
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

  it('GET lists regions ordered by name', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findManyMock.mockResolvedValue([{ id: 'r1', regionId: 'jatim', name: 'Jawa Timur' }]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.regions).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    );
  });

  it('POST rejects invalid regionId format', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(
      makePostRequest({ ...validRegion, regionId: 'Invalid Region!' }),
      params
    );
    expect(res.status).toBe(400);
  });

  it('POST creates a region when permitted', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    createMock.mockResolvedValue({ id: 'r1', ...validRegion });

    const res = await POST(makePostRequest(validRegion), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.region.regionId).toBe('jatim');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ universeId: 'uni-1', regionId: 'jatim' }),
      })
    );
  });

  it('POST returns 403 for VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest(validRegion), params);
    expect(res.status).toBe(403);
  });
});
