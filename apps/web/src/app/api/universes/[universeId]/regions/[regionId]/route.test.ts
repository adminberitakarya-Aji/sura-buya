import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const findFirstOrThrowMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

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
      findFirstOrThrow: (...args: unknown[]) => findFirstOrThrowMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
  },
}));

import { GET, PATCH, DELETE } from './route';

const params = { params: { universeId: 'uni-1', regionId: 'r1' } };

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/regions/r1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/regions/[regionId]', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findFirstOrThrowMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'), params);
    expect(res.status).toBe(401);
  });

  it('GET returns the region when permitted', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findFirstOrThrowMock.mockResolvedValue({ id: 'r1', name: 'Jawa Timur' });
    const res = await GET(makeRequest('GET'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.region.name).toBe('Jawa Timur');
  });

  it('PATCH updates the region when permitted', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    findFirstOrThrowMock.mockResolvedValue({ id: 'r1' });
    updateMock.mockResolvedValue({ id: 'r1', name: 'Jawa Timur Baru' });

    const res = await PATCH(makeRequest('PATCH', { name: 'Jawa Timur Baru' }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.region.name).toBe('Jawa Timur Baru');
  });

  it('PATCH returns 403 for VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await PATCH(makeRequest('PATCH', { name: 'x' }), params);
    expect(res.status).toBe(403);
  });

  it('DELETE removes the region when permitted', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    findFirstOrThrowMock.mockResolvedValue({ id: 'r1' });
    deleteMock.mockResolvedValue({ id: 'r1' });

    const res = await DELETE(makeRequest('DELETE'), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
