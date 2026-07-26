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
