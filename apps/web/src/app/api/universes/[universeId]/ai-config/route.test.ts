import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const findManyMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...args: unknown[]) => assertCanMock(...args) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIConfig: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { GET } from './route';

const params = { params: { universeId: 'uni-1' } };
const originalKey = process.env.ENCRYPTION_KEY;

describe('GET /api/universes/[universeId]/ai-config', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findManyMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for members without ai-config:read', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await GET(new NextRequest('http://localhost/x'), params);
    expect(res.status).toBe(403);
  });

  it('never returns the raw apiKeyEncrypted field', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    findManyMock.mockResolvedValue([
      {
        id: 'cfg-1',
        task: 'CREATIVE_GENERATION',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        parameters: null,
        isDefault: true,
        apiKeyEncrypted: 'iv:tag:ciphertext-should-never-leak',
        updatedAt: new Date(),
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();
    const body = JSON.stringify(json);

    expect(res.status).toBe(200);
    expect(json.configs[0].hasApiKey).toBe(true);
    expect(body).not.toContain('apiKeyEncrypted');
    expect(body).not.toContain('ciphertext-should-never-leak');
  });

  it('returns hasApiKey: false and apiKeyMasked: null when no key is set', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    findManyMock.mockResolvedValue([
      {
        id: 'cfg-1',
        task: 'PLANNING',
        provider: 'openai',
        model: 'gpt-4o',
        parameters: null,
        isDefault: false,
        apiKeyEncrypted: null,
        updatedAt: new Date(),
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/x'), params);
    const json = await res.json();

    expect(json.configs[0].hasApiKey).toBe(false);
    expect(json.configs[0].apiKeyMasked).toBeNull();
  });
});
