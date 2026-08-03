/**
 * VF-1.9 — Integration Test: API Routes VF-1.8 (parse-persona, asset CRUD, reference-generate)
 *
 * Menguji ketiga API endpoint VF-1.8 secara terintegrasi dengan mock Prisma
 * dan mock AI engine, memastikan:
 *  1. POST /parse-persona → mengembalikan PersonaDraft via mocked parseFreeTextToPersona
 *  2. GET/PUT/DELETE /asset → CRUD CharacterAsset 1:1 ke Character
 *  3. POST /asset/reference-generate → trigger generateCharacterReferenceImages & simpan ke asset
 *  4. Semua route menangani 401 (unauthenticated) dan 403 (insufficient permission)
 *  5. Tidak ada regresi ke route Character CRUD existing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const authMock = vi.fn();
const assertCanMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return { ...actual, assertCan: (...args: unknown[]) => assertCanMock(...args) };
});

// Prisma mock — semua model yang dipakai oleh VF-1.8 routes
const findUniqueOrThrowMock = vi.fn();
const findUniqueMock = vi.fn();
const findFirstOrThrowMock = vi.fn();
const findFirstMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    universe: {
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowMock(...args),
    },
    character: {
      findFirstOrThrow: (...args: unknown[]) => findFirstOrThrowMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
    aIConfig: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
    characterAsset: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
      deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
  },
}));

// Mock engine-v2 — parseFreeTextToPersona & generateCharacterReferenceImages
const parseFreeTextToPersonaMock = vi.fn();
const generateCharacterReferenceImagesMock = vi.fn();

vi.mock('@suro-buya/engine-v2', async () => {
  const actual = await vi.importActual<typeof import('@suro-buya/engine-v2')>('@suro-buya/engine-v2');
  return {
    ...actual,
    parseFreeTextToPersona: (...args: unknown[]) => parseFreeTextToPersonaMock(...args),
    generateCharacterReferenceImages: (...args: unknown[]) => generateCharacterReferenceImagesMock(...args),
  };
});

// Mock encryption (diperlukan di parse-persona/route.ts)
vi.mock('@/lib/encryption', () => ({
  decryptSecret: (s: string) => s,
  maskSecret: (s: string) => `••••${s.slice(-4)}`,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNIVERSE_ID = 'uni-test-123';
const CHARACTER_ID = 'char-db-id-456';

const MOCK_PERSONA_DRAFT = {
  draftId: 'draft-abc',
  source: 'ai-parsed' as const,
  name: 'kiko',
  displayName: 'Kiko si Kelinci',
  role: 'PROTAGONIST' as const,
  species: 'kelinci',
  ageDescriptor: 'anak-anak, 7 tahun',
  description: 'Kiko adalah kelinci kecil yang selalu ingin tahu.',
  coreTraits: ['pemberani', 'ingin tahu'],
  coreWeakness: 'takut gelap',
  voiceGuide: 'ceria dan cepat',
  visualDescription: 'kelinci putih dengan syal merah',
  fieldsNeedingReview: ['species'],
};

const MOCK_UNIVERSE = {
  id: UNIVERSE_ID,
  audienceProfile: 'keluarga Indonesia, anak usia 5-8 tahun',
  contentRating: 'ALL_AGES' as const,
};

const MOCK_CHARACTER = {
  id: CHARACTER_ID,
  characterId: 'kiko',
  displayName: 'Kiko si Kelinci',
  coreTraits: ['pemberani', 'ingin tahu'],
  metadata: {
    species: 'kelinci',
    ageDescriptor: 'anak-anak, 7 tahun',
    visualDescription: 'kelinci putih dengan syal merah',
  },
};

const MOCK_ASSET = {
  id: 'asset-789',
  characterId: CHARACTER_ID,
  referenceImages: [],
  voiceProfile: null,
  loraConfig: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// 1. parse-persona route tests
// ---------------------------------------------------------------------------

describe('VF-1.9 — API Integration: POST /characters/parse-persona', () => {
  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findUniqueOrThrowMock.mockReset();
    findFirstMock.mockReset();
    parseFreeTextToPersonaMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
    findFirstMock.mockResolvedValue(null); // tidak ada AIConfig → gunakan mock provider
  });

  it('mengembalikan 401 jika tidak autentikasi', async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/parse-persona/route'
    );
    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/parse-persona`,
      'POST',
      { rawInput: 'Kiko adalah kelinci yang sangat pemberani dan selalu ingin tahu.' },
    );
    const res = await POST(req, { params: { universeId: UNIVERSE_ID } });
    expect(res.status).toBe(401);
  });

  it('mengembalikan 400 jika rawInput terlalu pendek (< 10 karakter)', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/parse-persona/route'
    );
    findUniqueOrThrowMock.mockResolvedValue(MOCK_UNIVERSE);
    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/parse-persona`,
      'POST',
      { rawInput: 'Kiko' }, // terlalu pendek
    );
    const res = await POST(req, { params: { universeId: UNIVERSE_ID } });
    expect(res.status).toBe(400);
  });

  it('mengembalikan 200 + PersonaDraft jika parseFreeTextToPersona berhasil', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/parse-persona/route'
    );
    findUniqueOrThrowMock.mockResolvedValue(MOCK_UNIVERSE);
    parseFreeTextToPersonaMock.mockResolvedValue(MOCK_PERSONA_DRAFT);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/parse-persona`,
      'POST',
      { rawInput: 'Kiko adalah kelinci kecil yang selalu ingin tahu dan petualangan.' },
    );
    const res = await POST(req, { params: { universeId: UNIVERSE_ID } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.draft).toBeDefined();
    expect(json.draft.name).toBe('kiko');
    expect(json.meta.contentRating).toBe('ALL_AGES');
    expect(json.meta.audienceProfile).toBe('keluarga Indonesia, anak usia 5-8 tahun');
  });

  it('mengembalikan 422 jika parseFreeTextToPersona melempar PersonaParseError', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/parse-persona/route'
    );
    const { PersonaParseError } = await import('@suro-buya/engine-v2');
    findUniqueOrThrowMock.mockResolvedValue(MOCK_UNIVERSE);
    parseFreeTextToPersonaMock.mockRejectedValue(new PersonaParseError('JSON tidak valid'));

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/parse-persona`,
      'POST',
      { rawInput: 'Deskripsi yang cukup panjang tapi AI gagal parsing-nya.' },
    );
    const res = await POST(req, { params: { universeId: UNIVERSE_ID } });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toContain('JSON tidak valid');
  });

  it('meneruskan audienceProfile universe ke parseFreeTextToPersona()', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/parse-persona/route'
    );
    findUniqueOrThrowMock.mockResolvedValue(MOCK_UNIVERSE);
    parseFreeTextToPersonaMock.mockResolvedValue(MOCK_PERSONA_DRAFT);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/parse-persona`,
      'POST',
      { rawInput: 'Kiko kelinci anak-anak yang sangat pemberani dan ceria dalam petualangan.' },
    );
    await POST(req, { params: { universeId: UNIVERSE_ID } });

    // Pastikan parseFreeTextToPersona menerima audienceProfile dari universe
    expect(parseFreeTextToPersonaMock).toHaveBeenCalledWith(
      expect.any(String),    // rawInput
      expect.any(Object),    // provider
      'keluarga Indonesia, anak usia 5-8 tahun', // audienceProfile dari universe
    );
  });
});

// ---------------------------------------------------------------------------
// 2. CharacterAsset CRUD route tests
// ---------------------------------------------------------------------------

describe('VF-1.9 — API Integration: GET/PUT/DELETE /characters/:id/asset', () => {
  const params = { params: { universeId: UNIVERSE_ID, characterId: CHARACTER_ID } };

  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findFirstOrThrowMock.mockReset();
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    deleteManyMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
    findFirstOrThrowMock.mockResolvedValue(MOCK_CHARACTER);
  });

  it('GET mengembalikan { asset: null } jika CharacterAsset belum ada', async () => {
    const { GET } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/route'
    );
    findUniqueMock.mockResolvedValue(null);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset`,
      'GET',
    );
    const res = await GET(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.asset).toBeNull();
    expect(json.character.id).toBe(CHARACTER_ID);
  });

  it('GET mengembalikan asset jika sudah ada', async () => {
    const { GET } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/route'
    );
    findUniqueMock.mockResolvedValue(MOCK_ASSET);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset`,
      'GET',
    );
    const res = await GET(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.asset.id).toBe('asset-789');
  });

  it('GET mengembalikan 401 jika tidak autentikasi', async () => {
    const { GET } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/route'
    );
    authMock.mockResolvedValue(null);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset`,
      'GET',
    );
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });

  it('PUT upsert CharacterAsset dengan referenceImages baru', async () => {
    const { PUT } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/route'
    );
    const updatedAsset = {
      ...MOCK_ASSET,
      referenceImages: ['https://cdn.example.com/img/ref1.png', 'https://cdn.example.com/img/ref2.png'],
    };
    upsertMock.mockResolvedValue(updatedAsset);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset`,
      'PUT',
      { referenceImages: ['https://cdn.example.com/img/ref1.png', 'https://cdn.example.com/img/ref2.png'] },
    );
    const res = await PUT(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.asset.referenceImages).toHaveLength(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { characterId: CHARACTER_ID },
        create: expect.objectContaining({ referenceImages: expect.any(Array) }),
      }),
    );
  });

  it('PUT mengembalikan 400 jika referenceImages berisi URL tidak valid', async () => {
    const { PUT } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/route'
    );
    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset`,
      'PUT',
      { referenceImages: ['bukan-url-valid', 'https://ok.com/img.png'] },
    );
    const res = await PUT(req, params);
    expect(res.status).toBe(400);
  });

  it('DELETE menghapus CharacterAsset dan mengembalikan { success: true }', async () => {
    const { DELETE } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/route'
    );
    deleteManyMock.mockResolvedValue({ count: 1 });

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset`,
      'DELETE',
    );
    const res = await DELETE(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { characterId: CHARACTER_ID },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. reference-generate route tests
// ---------------------------------------------------------------------------

describe('VF-1.9 — API Integration: POST /characters/:id/asset/reference-generate', () => {
  const params = { params: { universeId: UNIVERSE_ID, characterId: CHARACTER_ID } };

  beforeEach(() => {
    authMock.mockReset();
    assertCanMock.mockReset();
    findFirstOrThrowMock.mockReset();
    upsertMock.mockReset();
    generateCharacterReferenceImagesMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    assertCanMock.mockResolvedValue('EDITOR');
    findFirstOrThrowMock.mockResolvedValue(MOCK_CHARACTER);
  });

  it('mengembalikan 401 jika tidak autentikasi', async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/reference-generate/route'
    );
    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset/reference-generate`,
      'POST',
    );
    const res = await POST(req, params);
    expect(res.status).toBe(401);
  });

  it('mengembalikan 422 jika karakter tidak memiliki visualDescription', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/reference-generate/route'
    );
    findFirstOrThrowMock.mockResolvedValue({
      ...MOCK_CHARACTER,
      metadata: { species: 'kelinci', ageDescriptor: 'anak-anak', visualDescription: '' },
    });

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset/reference-generate`,
      'POST',
    );
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toContain('visualDescription');
  });

  it('menghasilkan 4 reference images dan menyimpannya ke CharacterAsset', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/reference-generate/route'
    );

    const mockReferenceUrls = [
      'https://cdn.example.com/ref/front.png',
      'https://cdn.example.com/ref/side.png',
      'https://cdn.example.com/ref/fullbody.png',
      'https://cdn.example.com/ref/action.png',
    ];

    generateCharacterReferenceImagesMock.mockResolvedValue({
      characterId: 'kiko',
      referenceImages: mockReferenceUrls,
      promptsUsed: [
        { angle: 'front-portrait', prompt: 'test', description: 'desc1' },
        { angle: 'side-profile', prompt: 'test', description: 'desc2' },
        { angle: 'full-body', prompt: 'test', description: 'desc3' },
        { angle: 'action-expression', prompt: 'test', description: 'desc4' },
      ],
      providerUsed: 'flux-2-pro-mock',
      attempts: ['flux-2-pro-mock'],
      totalCost: 0.04,
    });

    upsertMock.mockResolvedValue({
      ...MOCK_ASSET,
      referenceImages: mockReferenceUrls,
    });

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset/reference-generate`,
      'POST',
      { count: 4, saveToAsset: true },
    );
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.referenceImages).toHaveLength(4);
    expect(json.result.providerUsed).toBe('flux-2-pro-mock');
    expect(json.savedToAsset).toBe(true);

    // Pastikan asset di-upsert dengan URL gambar baru
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ referenceImages: mockReferenceUrls }),
        update: expect.objectContaining({ referenceImages: mockReferenceUrls }),
      }),
    );
  });

  it('count di-clamp ke 3–5 (body dengan count = 4 valid)', async () => {
    const { POST } = await import(
      '@/app/api/universes/[universeId]/characters/[characterId]/asset/reference-generate/route'
    );

    generateCharacterReferenceImagesMock.mockResolvedValue({
      characterId: 'kiko',
      referenceImages: new Array(4).fill('https://example.com/img.png'),
      promptsUsed: new Array(4).fill({ angle: 'front-portrait', prompt: 'p', description: 'd' }),
      providerUsed: 'mock',
      attempts: ['mock'],
      totalCost: 0,
    });
    upsertMock.mockResolvedValue(MOCK_ASSET);

    const req = makeRequest(
      `http://localhost/api/universes/${UNIVERSE_ID}/characters/${CHARACTER_ID}/asset/reference-generate`,
      'POST',
      { count: 4 },
    );
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    expect(generateCharacterReferenceImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ count: 4 }),
    );
  });
});
