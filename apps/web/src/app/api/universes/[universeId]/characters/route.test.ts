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
    character: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1' } };

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/characters', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const validCharacter = {
  characterId: 'suro',
  name: 'Suro',
  role: 'PROTAGONIST',
  displayName: 'Suro the Shark',
  coreWeakness: 'Too impulsive',
};

describe('/api/universes/[universeId]/characters', () => {
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

  it('GET lists characters ordered by `order`', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    findManyMock.mockResolvedValue([{ id: 'c1', characterId: 'suro' }]);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.characters).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { order: 'asc' } })
    );
  });

  it('POST rejects invalid characterId format', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(
      makePostRequest({ ...validCharacter, characterId: 'Invalid ID!' }),
      params
    );
    expect(res.status).toBe(400);
  });

  it('POST creates a character when permitted', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    createMock.mockResolvedValue({ id: 'c1', ...validCharacter });

    const res = await POST(makePostRequest(validCharacter), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.character.characterId).toBe('suro');
  });

  it('POST creates CharacterAsset atomically (nested create)', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    createMock.mockResolvedValue({ id: 'c1', ...validCharacter });

    await POST(makePostRequest(validCharacter), params);

    // Verifikasi bahwa prisma.character.create dipanggil dengan data
    // yang menyertakan nested characterAsset.create (atomic 1:1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: 'suro',
          characterAsset: expect.objectContaining({
            create: expect.objectContaining({
              referenceImages: [],
            }),
          }),
        }),
      })
    );
  });

  it('POST returns 409 when characterId already exists (P2002)', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const prismaError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    createMock.mockRejectedValue(prismaError);

    const res = await POST(makePostRequest(validCharacter), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain('sudah ada');
  });

  it('POST returns 403 for VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest(validCharacter), params);
    expect(res.status).toBe(403);
  });
});