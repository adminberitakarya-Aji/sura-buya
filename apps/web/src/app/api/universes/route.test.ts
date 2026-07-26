import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const findManyMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    universe: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { GET, POST } from './route';

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('GET /api/universes', () => {
  beforeEach(() => {
    authMock.mockReset();
    findManyMock.mockReset();
    createMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns universes for the authenticated user', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    findManyMock.mockResolvedValue([
      {
        id: 'uni-1',
        slug: 'suro-buya',
        name: 'Suro & Buya',
        description: null,
        version: '1.0.0',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { characters: 2, episodes: 0, regions: 1 },
        members: [{ role: 'OWNER' }],
      },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.universes).toHaveLength(1);
    expect(json.universes[0].slug).toBe('suro-buya');
    expect(json.universes[0].role).toBe('OWNER');
  });
});

describe('POST /api/universes', () => {
  beforeEach(() => {
    authMock.mockReset();
    findManyMock.mockReset();
    createMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makePostRequest({ slug: 'test', name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid slug', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await POST(makePostRequest({ slug: 'Invalid Slug!', name: 'Test' }));
    expect(res.status).toBe(400);
  });

  it('creates the universe and returns 201', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    createMock.mockResolvedValue({
      id: 'uni-1',
      slug: 'suro-buya',
      name: 'Suro & Buya',
    });

    const res = await POST(makePostRequest({ slug: 'suro-buya', name: 'Suro & Buya' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.universe.slug).toBe('suro-buya');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'suro-buya',
          ownerId: 'user-1',
          members: { create: { userId: 'user-1', role: 'OWNER' } },
        }),
      })
    );
  });
});
