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
    bibleFile: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1' } };

const validBibleFile = {
  category: 'CHARACTER',
  path: 'voice-protagonist.md',
  title: 'Voice Guide: Protagonist',
  content: '# Voice Guide\n\nSuro speaks with...',
};

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/bible', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/bible', () => {
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

  it('GET lists bible files without content (list view)', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findManyMock.mockResolvedValue([
      { id: 'b1', category: 'CHARACTER', path: 'voice-protagonist.md', title: 'x', version: 1 },
    ]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.bibleFiles).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ content: true }),
      })
    );
  });

  it('GET filters by valid category query param', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findManyMock.mockResolvedValue([]);
    await GET(
      new NextRequest('http://localhost/x?category=WORLD'),
      params
    );
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'WORLD' }),
      })
    );
  });

  it('GET ignores invalid category query param', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findManyMock.mockResolvedValue([]);
    await GET(new NextRequest('http://localhost/x?category=NOT_REAL'), params);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { universeId: 'uni-1' },
      })
    );
  });

  it('POST rejects invalid path (must end in .md, lowercase)', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(
      makePostRequest({ ...validBibleFile, path: 'Voice_Protagonist.txt' }),
      params
    );
    expect(res.status).toBe(400);
  });

  it('POST creates a bible file when permitted', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    createMock.mockResolvedValue({ id: 'b1', ...validBibleFile, version: 1 });

    const res = await POST(makePostRequest(validBibleFile), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.bibleFile.path).toBe('voice-protagonist.md');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          universeId: 'uni-1',
          createdById: 'user-1',
          updatedById: 'user-1',
        }),
      })
    );
  });

  it('POST returns 403 for VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest(validBibleFile), params);
    expect(res.status).toBe(403);
  });
});
