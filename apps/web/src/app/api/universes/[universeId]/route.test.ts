import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const findUniqueOrThrowMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return {
    ...actual,
    assertCan: (...args: unknown[]) => assertCanMock(...args),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    universe: {
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
  },
}));

import { GET, PATCH, DELETE } from './route';
import { ForbiddenError, UnauthorizedError } from '@/lib/rbac';

const params = { params: { universeId: 'uni-1' } };

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findUniqueOrThrowMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'), params);
    expect(res.status).toBe(401);
  });

  it('GET returns 401 for non-members (UnauthorizedError)', async () => {
    assertCanMock.mockRejectedValue(new UnauthorizedError());
    const res = await GET(makeRequest('GET'), params);
    expect(res.status).toBe(401);
  });

  it('GET returns the universe when permitted', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findUniqueOrThrowMock.mockResolvedValue({ id: 'uni-1', slug: 'suro-buya' });
    const res = await GET(makeRequest('GET'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.universe.slug).toBe('suro-buya');
  });

  it('PATCH returns 403 when member lacks permission (ForbiddenError)', async () => {
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await PATCH(makeRequest('PATCH', { name: 'New name' }), params);
    expect(res.status).toBe(403);
  });

  it('PATCH updates the universe when permitted', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    updateMock.mockResolvedValue({ id: 'uni-1', name: 'New name' });
    const res = await PATCH(makeRequest('PATCH', { name: 'New name' }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.universe.name).toBe('New name');
  });

  it('DELETE removes the universe when permitted', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    deleteMock.mockResolvedValue({ id: 'uni-1' });
    const res = await DELETE(makeRequest('DELETE'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('DELETE returns 403 for non-owners', async () => {
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await DELETE(makeRequest('DELETE'), params);
    expect(res.status).toBe(403);
  });
});
