import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const assertCanMock = vi.fn();
const sceneFindFirstMock = vi.fn();
const runJobMock = vi.fn();
const buildValidationContextMock = vi.fn();
const buildCanonValidatorForUniverseMock = vi.fn();
const buildJudgingCriteriaMock = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: (...a: unknown[]) => authMock(...a) }));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...a: unknown[]) => assertCanMock(...a) };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scene: {
      findFirst: (...a: unknown[]) => sceneFindFirstMock(...a),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/jobs', () => ({
  runJob: (...a: unknown[]) => runJobMock(...a),
}));

vi.mock('@/lib/engine/validation-context', () => ({
  buildValidationContext: (...a: unknown[]) => buildValidationContextMock(...a),
}));

vi.mock('@/lib/engine/validator', () => ({
  buildCanonValidatorForUniverse: (...a: unknown[]) => buildCanonValidatorForUniverseMock(...a),
  buildJudgingCriteria: (...a: unknown[]) => buildJudgingCriteriaMock(...a),
}));

import { POST } from './route';

const params = { params: { universeId: 'uni-1', episodeId: 'ep-1', sceneId: 'scene-1' } };

function makeRequest() {
  return new NextRequest('http://localhost/x', { method: 'POST' });
}

describe('POST /api/.../scenes/[sceneId]/validate', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    sceneFindFirstMock.mockReset();
    runJobMock.mockReset();
    buildValidationContextMock.mockReset();
    buildCanonValidatorForUniverseMock.mockReset();
    buildJudgingCriteriaMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the scene does not exist / is not scoped to this episode+universe', async () => {
    sceneFindFirstMock.mockResolvedValue(null);
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(404);
  });

  it('returns 400 when the scene has no generatedText yet', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: null });
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(400);
    expect(runJobMock).not.toHaveBeenCalled();
  });

  it('runs validation and returns the report on success', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Some scene text.' });
    runJobMock.mockResolvedValue({
      job: { id: 'job-1', status: 'COMPLETED' },
      result: { validation: { valid: true, consistencyScore: 0.95, errors: [], warnings: [], infos: [] } },
    });

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.validation.valid).toBe(true);
    expect(runJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CANON_VALIDATION' }),
      expect.any(Function)
    );
  });

  it('returns 502 with the job when the underlying work throws', async () => {
    sceneFindFirstMock.mockResolvedValue({ id: 'scene-1', generatedText: 'Some scene text.' });
    runJobMock.mockResolvedValue({
      job: { id: 'job-1', status: 'FAILED' },
      error: 'Provider unavailable',
    });

    const res = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe('Provider unavailable');
  });

  it('returns 403 when the caller lacks content:write', async () => {
    const { ForbiddenError } = await import('@/lib/rbac');
    assertCanMock.mockRejectedValue(new ForbiddenError());
    const res = await POST(makeRequest(), params);
    expect(res.status).toBe(403);
  });
});
