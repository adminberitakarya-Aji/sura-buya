import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const episodeFindManyMock = vi.fn();
const episodeCreateMock = vi.fn();
const seasonFindFirstOrThrowMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    episode: {
      findMany: (...a: unknown[]) => episodeFindManyMock(...a),
      create: (...a: unknown[]) => episodeCreateMock(...a),
    },
    season: {
      findFirstOrThrow: (...a: unknown[]) => seasonFindFirstOrThrowMock(...a),
    },
  },
}));

import { GET, POST } from './route';

const params = { params: { universeId: 'uni-1' } };

const validEpisode = {
  seasonId: 'season-1',
  episodeNumber: 1,
  title: 'Peta Misterius',
  premise: 'Suro dan Buya menemukan peta harta karun tua.',
};

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/episodes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/episodes', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    episodeFindManyMock.mockReset();
    episodeCreateMock.mockReset();
    seasonFindFirstOrThrowMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('GET returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('GET lists all episodes when no seasonId filter is given', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    episodeFindManyMock.mockResolvedValue([]);
    await GET(new NextRequest('http://localhost/api/universes/uni-1/episodes'), params);
    expect(episodeFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { universeId: 'uni-1' } })
    );
  });

  it('GET filters by seasonId query param when present', async () => {
    assertCanMock.mockResolvedValue('VIEWER');
    episodeFindManyMock.mockResolvedValue([]);
    await GET(
      new NextRequest('http://localhost/api/universes/uni-1/episodes?seasonId=season-1'),
      params
    );
    expect(episodeFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { universeId: 'uni-1', seasonId: 'season-1' } })
    );
  });

  it('POST rejects a premise that is too short (empty)', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    const res = await POST(makePostRequest({ ...validEpisode, premise: '' }), params);
    expect(res.status).toBe(400);
  });

  it('POST returns 404-style error when the season does not belong to this universe', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    seasonFindFirstOrThrowMock.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'P2025' })
    );
    const res = await POST(makePostRequest(validEpisode), params);
    expect(res.status).toBe(404);
    expect(episodeCreateMock).not.toHaveBeenCalled();
  });

  it('POST creates an episode scoped to the universe with default targetScenes', async () => {
    assertCanMock.mockResolvedValue('EDITOR');
    seasonFindFirstOrThrowMock.mockResolvedValue({ id: 'season-1' });
    episodeCreateMock.mockResolvedValue({ id: 'ep-1', ...validEpisode });

    const res = await POST(makePostRequest(validEpisode), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.episode.id).toBe('ep-1');
    expect(episodeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ universeId: 'uni-1', targetScenes: 6 }),
      })
    );
  });

  it('POST returns 403 for a VIEWER role', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makePostRequest(validEpisode), params);
    expect(res.status).toBe(403);
  });
});
