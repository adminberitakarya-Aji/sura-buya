export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Terjadi kesalahan', res.status, body?.details);
  }

  return body as T;
}

// ---- Types (mirrors Prisma models, trimmed to what the client needs) ----

export type MemberRole = 'OWNER' | 'EDITOR' | 'REVIEWER' | 'VIEWER';

export interface UniverseSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  role: MemberRole;
  counts: { characters: number; episodes: number; regions: number };
}

export interface CreateUniverseInput {
  slug: string;
  name: string;
  description?: string;
  manifest?: Record<string, unknown>;
  isPublic?: boolean;
}

export type CharacterRole =
  | 'PROTAGONIST'
  | 'DEUTERAGONIST'
  | 'SUPPORTING'
  | 'ANTAGONIST'
  | 'NARRATOR';

export interface CreateCharacterInput {
  characterId: string;
  name: string;
  role: CharacterRole;
  displayName: string;
  coreWeakness: string;
  coreTraits?: string[];
  description?: string;
  voiceGuide?: string;
}

// ---- Universes ----

export interface UniverseDetail extends Omit<UniverseSummary, 'counts' | 'role'> {
  manifest: Record<string, unknown>;
  ownerId: string;
  _count: { characters: number; episodes: number; regions: number };
  members: {
    userId: string;
    role: MemberRole;
    user: { name: string | null; email: string | null; image: string | null };
  }[];
}

export const universesApi = {
  list: () => request<{ universes: UniverseSummary[] }>('/api/universes'),

  get: (universeId: string) =>
    request<{ universe: UniverseDetail }>(`/api/universes/${universeId}`),

  create: (input: CreateUniverseInput) =>
    request<{ universe: UniverseSummary }>('/api/universes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  remove: (universeId: string) =>
    request<{ success: true }>(`/api/universes/${universeId}`, { method: 'DELETE' }),
};

export interface Character {
  id: string;
  universeId: string;
  characterId: string;
  name: string;
  role: CharacterRole;
  displayName: string;
  description: string | null;
  coreTraits: string[];
  coreWeakness: string;
  voiceGuide: string | null;
  bibleRef: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCharacterInput {
  name?: string;
  role?: CharacterRole;
  displayName?: string;
  description?: string | null;
  coreTraits?: string[];
  coreWeakness?: string;
  voiceGuide?: string | null;
  order?: number;
}

export interface Region {
  id: string;
  universeId: string;
  regionId: string;
  name: string;
  description: string | null;
  cultureGuide: string | null;
  geography: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegionInput {
  regionId: string;
  name: string;
  description?: string;
  cultureGuide?: string;
  geography?: string;
}

export interface UpdateRegionInput {
  name?: string;
  description?: string | null;
  cultureGuide?: string | null;
  geography?: string | null;
}

export type BibleCategory = 'CHARACTER' | 'WORLD' | 'STORY' | 'VISUAL' | 'PRODUCTION';

export interface BibleFileSummary {
  id: string;
  category: BibleCategory;
  path: string;
  title: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BibleFileDetail extends BibleFileSummary {
  universeId: string;
  content: string;
  frontmatter: Record<string, unknown> | null;
}

export interface CreateBibleFileInput {
  category: BibleCategory;
  path: string;
  title: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}

export interface UpdateBibleFileInput {
  title?: string;
  content?: string;
  frontmatter?: Record<string, unknown> | null;
}

// ---- Bible Files ----

export const bibleApi = {
  list: (universeId: string, category?: BibleCategory) =>
    request<{ bibleFiles: BibleFileSummary[] }>(
      `/api/universes/${universeId}/bible${category ? `?category=${category}` : ''}`
    ),

  get: (universeId: string, bibleFileId: string) =>
    request<{ bibleFile: BibleFileDetail }>(
      `/api/universes/${universeId}/bible/${bibleFileId}`
    ),

  create: (universeId: string, input: CreateBibleFileInput) =>
    request<{ bibleFile: BibleFileDetail }>(`/api/universes/${universeId}/bible`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (universeId: string, bibleFileId: string, input: UpdateBibleFileInput) =>
    request<{ bibleFile: BibleFileDetail }>(
      `/api/universes/${universeId}/bible/${bibleFileId}`,
      { method: 'PATCH', body: JSON.stringify(input) }
    ),

  remove: (universeId: string, bibleFileId: string) =>
    request<{ success: true }>(`/api/universes/${universeId}/bible/${bibleFileId}`, {
      method: 'DELETE',
    }),
};

// ---- Regions ----

export const regionsApi = {
  list: (universeId: string) =>
    request<{ regions: Region[] }>(`/api/universes/${universeId}/regions`),

  create: (universeId: string, input: CreateRegionInput) =>
    request<{ region: Region }>(`/api/universes/${universeId}/regions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (universeId: string, regionId: string, input: UpdateRegionInput) =>
    request<{ region: Region }>(`/api/universes/${universeId}/regions/${regionId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  remove: (universeId: string, regionId: string) =>
    request<{ success: true }>(`/api/universes/${universeId}/regions/${regionId}`, {
      method: 'DELETE',
    }),
};

// ---- Characters ----

export const charactersApi = {
  list: (universeId: string) =>
    request<{ characters: Character[] }>(`/api/universes/${universeId}/characters`),

  create: (universeId: string, input: CreateCharacterInput) =>
    request<{ character: Character }>(`/api/universes/${universeId}/characters`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (universeId: string, characterId: string, input: UpdateCharacterInput) =>
    request<{ character: Character }>(
      `/api/universes/${universeId}/characters/${characterId}`,
      { method: 'PATCH', body: JSON.stringify(input) }
    ),

  remove: (universeId: string, characterId: string) =>
    request<{ success: true }>(`/api/universes/${universeId}/characters/${characterId}`, {
      method: 'DELETE',
    }),
};
