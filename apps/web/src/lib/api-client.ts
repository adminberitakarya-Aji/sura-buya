import type { SceneEditorBlock, BeatBoardBeat } from '@suro-buya/ui';

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
  /** VF-1.8: menyimpan field PersonaDraft tanpa kolom Prisma langsung (species, ageDescriptor, dll.) */
  metadata?: Record<string, unknown>;
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

export type AITask =
  | 'CREATIVE_GENERATION'
  | 'PLANNING'
  | 'VALIDATION'
  | 'EMBEDDING'
  | 'IMAGE_PROMPT'
  | 'CODE_GENERATION';

export interface AIConfigSummary {
  id: string;
  task: AITask;
  provider: string;
  model: string;
  parameters: Record<string, unknown> | null;
  isDefault: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  updatedAt: string;
}

export interface UpsertAIConfigInput {
  provider: string;
  model: string;
  /** Omit to leave the stored key untouched; pass '' to clear it. */
  apiKey?: string;
  parameters?: Record<string, unknown>;
  isDefault?: boolean;
}

// ---- AI Provider Config ----

export const aiConfigApi = {
  list: (universeId: string) =>
    request<{ configs: AIConfigSummary[] }>(`/api/universes/${universeId}/ai-config`),

  upsert: (universeId: string, task: AITask, input: UpsertAIConfigInput) =>
    request<{ config: AIConfigSummary }>(`/api/universes/${universeId}/ai-config/${task}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  remove: (universeId: string, task: AITask) =>
    request<{ success: true }>(`/api/universes/${universeId}/ai-config/${task}`, {
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

  /**
   * VF-1.8 — Parsing free-text menjadi PersonaDraft via AI (server-side).
   * Endpoint ini meneruskan rawInput ke persona-parser.ts bersama
   * audienceProfile dari konfigurasi universe, sehingga AI mendapat
   * konteks audiens yang tepat tanpa perlu client tahu detail konfigurasi.
   */
  parsePersona: (
    universeId: string,
    rawInput: string,
    audienceProfileOverride?: string,
  ) =>
    request<{
      draft: PersonaDraft;
      meta: { contentRating: string; audienceProfile: string | null; providerUsed: string };
    }>(`/api/universes/${universeId}/characters/parse-persona`, {
      method: 'POST',
      body: JSON.stringify({ rawInput, audienceProfileOverride }),
    }),
};

// ---- VF-1.8: CharacterAsset ----

export interface VoiceProfile {
  provider: string;
  voiceId: string;
  settings?: Record<string, unknown>;
}

export interface LoraConfig {
  loraPath: string;
  strength?: number;
}

export interface CharacterAsset {
  id: string;
  characterId: string; // FK ke Character.id
  referenceImages: string[];
  voiceProfile: VoiceProfile | null;
  loraConfig: LoraConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCharacterAssetInput {
  referenceImages?: string[];
  voiceProfile?: VoiceProfile | null;
  loraConfig?: LoraConfig | null;
}

export interface ReferenceGenerateInput {
  /** Jumlah gambar 3–5. Default: 4 */
  count?: number;
  /** Gaya visual art style */
  artStyle?: string;
  /** Otomatis simpan ke CharacterAsset.referenceImages setelah generate. Default: true */
  saveToAsset?: boolean;
}

export interface ReferenceGenerateResult {
  characterId: string;
  referenceImages: string[];
  promptsUsed: Array<{ angle: string; prompt: string; description: string }>;
  providerUsed: string;
  totalCost: number;
}

/** PersonaDraft — sesuai @suro-buya/shared */
export interface PersonaDraft {
  draftId: string;
  source: 'ai-parsed' | 'manual';
  name: string;
  displayName: string;
  role: 'PROTAGONIST' | 'DEUTERAGONIST' | 'SUPPORTING' | 'ANTAGONIST' | 'NARRATOR';
  species: string;
  ageDescriptor: string;
  description: string;
  coreTraits: string[];
  coreWeakness: string;
  motivation?: string;
  voiceGuide: string;
  visualDescription: string;
  fieldsNeedingReview: string[];
  rawInput?: string;
}

export const characterAssetApi = {
  /**
   * GET CharacterAsset untuk karakter tertentu.
   * Mengembalikan { asset: null } jika belum ada (bukan 404 error).
   */
  get: (universeId: string, characterId: string) =>
    request<{
      asset: CharacterAsset | null;
      character: { id: string; characterId: string; displayName: string };
    }>(`/api/universes/${universeId}/characters/${characterId}/asset`),

  /**
   * PUT (Upsert) CharacterAsset — buat atau perbarui.
   * Dipakai di Step 3 wizard untuk menyimpan reference images yang sudah diapprove.
   */
  upsert: (universeId: string, characterId: string, input: UpsertCharacterAssetInput) =>
    request<{ asset: CharacterAsset }>(
      `/api/universes/${universeId}/characters/${characterId}/asset`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),

  /**
   * DELETE CharacterAsset (menghapus lapisan visual/produksi, BUKAN Character-nya).
   */
  remove: (universeId: string, characterId: string) =>
    request<{ success: true }>(
      `/api/universes/${universeId}/characters/${characterId}/asset`,
      { method: 'DELETE' },
    ),

  /**
   * POST reference-generate — trigger VF-1.6 `generateCharacterReferenceImages()`
   * dari sisi server. Hasil URL gambar dikembalikan ke client.
   * Jika `saveToAsset=true` (default), URL juga disimpan ke CharacterAsset.referenceImages.
   */
  generateReferenceImages: (
    universeId: string,
    characterId: string,
    input: ReferenceGenerateInput = {},
  ) =>
    request<{ result: ReferenceGenerateResult; savedToAsset: boolean }>(
      `/api/universes/${universeId}/characters/${characterId}/asset/reference-generate`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};



export type SeasonStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export interface Season {
  id: string;
  universeId: string;
  seasonNumber: number;
  title: string;
  theme: string | null;
  arcSummary: string | null;
  episodeCount: number;
  status: SeasonStatus;
  plan: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { episodes: number };
}

export interface CreateSeasonInput {
  seasonNumber: number;
  title: string;
  theme?: string;
  arcSummary?: string;
  episodeCount?: number;
}

export const seasonsApi = {
  list: (universeId: string) =>
    request<{ seasons: Season[] }>(`/api/universes/${universeId}/seasons`),

  get: (universeId: string, seasonId: string) =>
    request<{ season: Season & { episodes: Episode[] } }>(
      `/api/universes/${universeId}/seasons/${seasonId}`
    ),

  create: (universeId: string, input: CreateSeasonInput) =>
    request<{ season: Season }>(`/api/universes/${universeId}/seasons`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  remove: (universeId: string, seasonId: string) =>
    request<{ success: true }>(`/api/universes/${universeId}/seasons/${seasonId}`, {
      method: 'DELETE',
    }),

  generatePlan: (universeId: string, seasonId: string, options?: {
    episodeCount?: number;
    targetRuntimeMinutes?: number;
    arcType?: 'serialized' | 'episodic' | 'anthology' | 'hybrid';
    themes?: string[];
    focusCharacters?: string[];
    tone?: string;
  }) =>
    request<{ job: any; plan?: any }>(`/api/universes/${universeId}/seasons/${seasonId}/plan`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    }),

  getPlan: (universeId: string, seasonId: string) =>
    request<{ plan?: any }>(`/api/universes/${universeId}/seasons/${seasonId}/plan`),
};

// ---- Episodes ----

export type EpisodeStatus =
  | 'PLANNING'
  | 'GENERATING'
  | 'REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface Episode {
  id: string;
  universeId: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  premise: string;
  status: EpisodeStatus;
  plan: Record<string, unknown> | null;
  targetScenes: number;
  createdAt: string;
  updatedAt: string;
  season?: { id: string; seasonNumber: number; title: string };
  scenes?: Scene[];
  _count?: { scenes: number };
}

export interface CreateEpisodeInput {
  seasonId: string;
  episodeNumber: number;
  title: string;
  premise: string;
  targetScenes?: number;
}

export interface UpdateEpisodeInput {
  title?: string;
  premise?: string;
  status?: EpisodeStatus;
  targetScenes?: number;
  plan?: Record<string, unknown> | null;
}

export const episodesApi = {
  list: (universeId: string, seasonId?: string) =>
    request<{ episodes: Episode[] }>(
      `/api/universes/${universeId}/episodes${seasonId ? `?seasonId=${seasonId}` : ''}`
    ),

  get: (universeId: string, episodeId: string) =>
    request<{ episode: Episode }>(`/api/universes/${universeId}/episodes/${episodeId}`),

  create: (universeId: string, input: CreateEpisodeInput) =>
    request<{ episode: Episode }>(`/api/universes/${universeId}/episodes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (universeId: string, episodeId: string, input: UpdateEpisodeInput) =>
    request<{ episode: Episode }>(`/api/universes/${universeId}/episodes/${episodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  remove: (universeId: string, episodeId: string) =>
    request<{ success: true }>(`/api/universes/${universeId}/episodes/${episodeId}`, {
      method: 'DELETE',
    }),
};

// ---- Scenes ----

export type SceneStatus = 'DRAFT' | 'GENERATED' | 'VALIDATED' | 'APPROVED' | 'REJECTED';

export interface Scene {
  id: string;
  episodeId: string;
  sceneNumber: number;
  premise: string;
  characters: string[];
  region: string | null;
  generatedText: string | null;
  blocks: SceneEditorBlock[] | null;
  validationReport: Record<string, unknown> | null;
  version: number;
  status: SceneStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSceneInput {
  sceneNumber: number;
  premise: string;
  characters?: string[];
  region?: string;
}

export interface UpdateSceneInput {
  premise?: string;
  characters?: string[];
  region?: string | null;
  generatedText?: string | null;
  status?: SceneStatus;
  validationReport?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  bumpVersion?: boolean;
}

export const scenesApi = {
  list: (universeId: string, episodeId: string) =>
    request<{ scenes: Scene[] }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes`
    ),

  get: (universeId: string, episodeId: string, sceneId: string) =>
    request<{ scene: Scene }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}`
    ),

  create: (universeId: string, episodeId: string, input: CreateSceneInput) =>
    request<{ scene: Scene }>(`/api/universes/${universeId}/episodes/${episodeId}/scenes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (universeId: string, episodeId: string, sceneId: string, input: UpdateSceneInput) =>
    request<{ scene: Scene }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}`,
      { method: 'PATCH', body: JSON.stringify(input) }
    ),

  remove: (universeId: string, episodeId: string, sceneId: string) =>
    request<{ success: true }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}`,
      { method: 'DELETE' }
    ),
};

export const blocksApi = {
  update: (universeId: string, episodeId: string, sceneId: string, blocks: SceneEditorBlock[]) =>
    request<{ scene: Scene }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}/blocks`,
      { method: 'PATCH', body: JSON.stringify({ blocks }) }
    ),
};

// ---- Episode Planning (Beat Board) ----

export interface EpisodePlan {
  id: string;
  season: number;
  number: number;
  title: string;
  logline: string;
  summary: string;
  beats: BeatBoardBeat[];
  acts: unknown[];
  scenes: { number: number; location: string; characters: string[]; summary: string }[];
  characterArcs: unknown[];
  themes: string[];
  runtimeMinutes: number;
}

export const planApi = {
  generate: (universeId: string, episodeId: string) =>
    request<{ job: GenerationJobSummary; plan: EpisodePlan }>(
      `/api/universes/${universeId}/episodes/${episodeId}/plan`,
      { method: 'POST' }
    ),

  updateBeats: (universeId: string, episodeId: string, beats: BeatBoardBeat[]) =>
    request<{ plan: EpisodePlan }>(`/api/universes/${universeId}/episodes/${episodeId}/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ beats }),
    }),

  createScenesFromPlan: (universeId: string, episodeId: string) =>
    request<{ created: number; scenes: Scene[] }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/from-plan`,
      { method: 'POST' }
    ),
};

// ---- Generation Jobs ----

export type JobType =
  | 'SCENE_GENERATION'
  | 'EPISODE_PLANNING'
  | 'SEASON_PLANNING'
  | 'CANON_VALIDATION'
  | 'EMBEDDING_INDEX';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface GenerationJobSummary {
  id: string;
  universeId: string;
  userId: string;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  progress: number;
  currentStep: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const jobsApi = {
  list: (universeId: string, filter?: { type?: JobType; status?: JobStatus }) => {
    const qs = new URLSearchParams();
    if (filter?.type) qs.set('type', filter.type);
    if (filter?.status) qs.set('status', filter.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ jobs: GenerationJobSummary[] }>(`/api/universes/${universeId}/jobs${suffix}`);
  },

  get: (universeId: string, jobId: string) =>
    request<{ job: GenerationJobSummary }>(
      `/api/universes/${universeId}/jobs?jobId=${jobId}`
    ),

  cancel: (universeId: string, jobId: string) =>
    request<{ job: GenerationJobSummary }>(`/api/universes/${universeId}/jobs`, {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    }),
};

// ---- Canon Validation ----

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface CanonValidationSummary {
  valid: boolean;
  consistencyScore: number;
  violations: unknown[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export const validationApi = {
  run: (universeId: string, episodeId: string, sceneId: string) =>
    request<{ job: GenerationJobSummary; validation: CanonValidationSummary }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}/validate`,
      { method: 'POST' }
    ),
};

// ---- Scene Versions & Reviews ----

export interface SceneVersion {
  id: string;
  sceneId: string;
  version: number;
  content: string;
  createdAt: string;
}

export type ReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export interface Review {
  id: string;
  sceneId: string;
  reviewerId: string;
  decision: ReviewDecision;
  feedback: string | null;
  annotations: Record<string, unknown> | null;
  createdAt: string;
  reviewer?: { id: string; name: string | null; email: string };
}

export const sceneVersionsApi = {
  list: (universeId: string, episodeId: string, sceneId: string) =>
    request<{ versions: SceneVersion[] }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}/versions`
    ),
};

export const reviewsApi = {
  list: (universeId: string, episodeId: string, sceneId: string) =>
    request<{ reviews: Review[] }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}/reviews`
    ),

  create: (
    universeId: string,
    episodeId: string,
    sceneId: string,
    input: { decision: ReviewDecision; feedback?: string }
  ) =>
    request<{ review: Review; scene: Scene }>(
      `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}/reviews`,
      { method: 'POST', body: JSON.stringify(input) }
    ),
};

// ---- Scene generation (SSE) ----

export interface GenerateSceneOptions {
  temperature?: number;
  maxTokens?: number;
  specialInstructions?: string;
}

export interface GenerateSceneCallbacks {
  onChunk?: (text: string) => void;
  onProgress?: (progress: number, step?: string) => void;
  onDone?: (jobId: string, scene: Scene) => void;
  onError?: (message: string) => void;
}

/**
 * Stream scene generation via Server-Sent Events. `EventSource` only
 * supports GET, so this reads the fetch POST body stream manually and
 * parses `event: ...\ndata: ...\n\n` frames as they arrive.
 */
export async function generateSceneStream(
  universeId: string,
  episodeId: string,
  sceneId: string,
  options: GenerateSceneOptions,
  callbacks: GenerateSceneCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(
    `/api/universes/${universeId}/episodes/${episodeId}/scenes/${sceneId}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      signal,
    }
  );

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({ error: 'Gagal memulai generation' }));
    callbacks.onError?.(body.error ?? 'Gagal memulai generation');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd = buffer.indexOf('\n\n');
    while (frameEnd !== -1) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);

      const eventMatch = frame.match(/^event: (.+)$/m);
      const dataMatch = frame.match(/^data: (.+)$/m);
      const event = eventMatch?.[1];
      const data = dataMatch?.[1] ? JSON.parse(dataMatch[1]) : {};

      if (event === 'chunk') callbacks.onChunk?.(data.text ?? '');
      else if (event === 'progress') callbacks.onProgress?.(data.progress, data.step);
      else if (event === 'done') callbacks.onDone?.(data.jobId, data.scene);
      else if (event === 'error') callbacks.onError?.(data.message ?? 'Generation gagal');

      frameEnd = buffer.indexOf('\n\n');
    }
  }
}
