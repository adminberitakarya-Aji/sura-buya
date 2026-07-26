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
    bibleFile: {
      findFirstOrThrow: (...args: unknown[]) => findFirstOrThrowMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
  },
}));

import { GET, PATCH, DELETE } from './route';

const params = { params: { universeId: 'uni-1', bibleFileId: 'b1' } };

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/bible/b1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/bible/[bibleFileId]', () => {
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

  it('GET returns full bible file including content', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findFirstOrThrowMock.mockResolvedValue({ id: 'b1', content: '# Hello' });
    const res = await GET(makeRequest('GET'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.bibleFile.content).toBe('# Hello');
  });

  it('PATCH increments version when content changes', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    findFirstOrThrowMock.mockResolvedValue({ id: 'b1' });
    updateMock.mockResolvedValue({ id: 'b1', version: 2 });

    const res = await PATCH(makeRequest('PATCH', { content: '# Updated' }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bibleFile.version).toBe(2);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    );
  });

  it('PATCH does not bump version for title-only change', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    findFirstOrThrowMock.mockResolvedValue({ id: 'b1' });
    updateMock.mockResolvedValue({ id: 'b1', title: 'New title' });

    await PATCH(makeRequest('PATCH', { title: 'New title' }), params);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ version: expect.anything() }),
      })
    );
  });

  it('PATCH returns 403 for VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await PATCH(makeRequest('PATCH', { content: 'x' }), params);
    expect(res.status).toBe(403);
  });

  it('DELETE removes the bible file when permitted', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    findFirstOrThrowMock.mockResolvedValue({ id: 'b1' });
    deleteMock.mockResolvedValue({ id: 'b1' });

    const res = await DELETE(makeRequest('DELETE'), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
