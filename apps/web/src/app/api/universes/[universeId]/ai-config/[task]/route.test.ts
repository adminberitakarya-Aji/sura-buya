import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const upsertMock = vi.fn();
const findUniqueMock = vi.fn();
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
    aIConfig: {
      upsert: (...args: unknown[]) => upsertMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
  },
}));

import { PUT, DELETE } from './route';

const params = { params: { universeId: 'uni-1', task: 'CREATIVE_GENERATION' } };
const originalKey = process.env.ENCRYPTION_KEY;

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/universes/uni-1/ai-config/CREATIVE_GENERATION', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

describe('/api/universes/[universeId]/ai-config/[task]', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    upsertMock.mockReset();
    findUniqueMock.mockReset();
    deleteMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('PUT returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await PUT(makeRequest('PUT', { provider: 'anthropic', model: 'x' }), params);
    expect(res.status).toBe(401);
  });

  it('PUT rejects an invalid task in the URL', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    const res = await PUT(
      makeRequest('PUT', { provider: 'anthropic', model: 'x' }),
      { params: { universeId: 'uni-1', task: 'NOT_A_REAL_TASK' } }
    );
    expect(res.status).toBe(400);
  });

  it('PUT encrypts the API key before persisting — never stores plaintext', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    upsertMock.mockResolvedValue({
      id: 'cfg-1',
      task: 'CREATIVE_GENERATION',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      parameters: null,
      isDefault: false,
      apiKeyEncrypted: 'iv:tag:ciphertext',
      updatedAt: new Date(),
    });

    const res = await PUT(
      makeRequest('PUT', {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        apiKey: 'sk-ant-plaintext-secret',
      }),
      params
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    const upsertArg = upsertMock.mock.calls[0][0];
    const storedKey = upsertArg.create.apiKeyEncrypted;
    expect(storedKey).toBeDefined();
    expect(storedKey).not.toBe('sk-ant-plaintext-secret');
    expect(JSON.stringify(json)).not.toContain('sk-ant-plaintext-secret');
  });

  it('PUT clears the API key when apiKey is an empty string', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    upsertMock.mockResolvedValue({
      id: 'cfg-1',
      task: 'CREATIVE_GENERATION',
      provider: 'anthropic',
      model: 'x',
      parameters: null,
      isDefault: false,
      apiKeyEncrypted: null,
      updatedAt: new Date(),
    });

    await PUT(makeRequest('PUT', { provider: 'anthropic', model: 'x', apiKey: '' }), params);

    const upsertArg = upsertMock.mock.calls[0][0];
    expect(upsertArg.create.apiKeyEncrypted).toBeNull();
  });

  it('PUT leaves the existing key untouched when apiKey is omitted', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    upsertMock.mockResolvedValue({
      id: 'cfg-1',
      task: 'CREATIVE_GENERATION',
      provider: 'anthropic',
      model: 'x',
      parameters: null,
      isDefault: false,
      apiKeyEncrypted: 'iv:tag:existing',
      updatedAt: new Date(),
    });

    await PUT(makeRequest('PUT', { provider: 'anthropic', model: 'x' }), params);

    const upsertArg = upsertMock.mock.calls[0][0];
    expect(upsertArg.create).not.toHaveProperty('apiKeyEncrypted');
    expect(upsertArg.update).not.toHaveProperty('apiKeyEncrypted');
  });

  it('PUT returns 403 for EDITOR role (ai-config:write requires OWNER)', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await PUT(makeRequest('PUT', { provider: 'anthropic', model: 'x' }), params);
    expect(res.status).toBe(403);
  });

  it('DELETE removes the config when it exists', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    findUniqueMock.mockResolvedValue({ id: 'cfg-1' });
    deleteMock.mockResolvedValue({ id: 'cfg-1' });

    const res = await DELETE(makeRequest('DELETE'), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'cfg-1' } });
  });

  it('DELETE is a no-op success when no config exists for the task', async () => {
    assertCanMock.mockResolvedValue('OWNER');
    findUniqueMock.mockResolvedValue(null);

    const res = await DELETE(makeRequest('DELETE'), params);

    expect(res.status).toBe(200);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
