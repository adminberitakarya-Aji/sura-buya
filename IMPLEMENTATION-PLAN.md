# Implementation Plan — AI Factory Multi-Universe (Suro & Buya)

> **Status:** Approved for Phase 0 Execution
> **Created:** 2026-07-25
> **Version:** 1.0

---

## 1. Executive Summary

Transformasi dari **single-universe vertical slice** (`engine/`) menjadi **production-ready AI Factory** multi-tenant untuk creator IP anak-anak Indonesia.

**Target MVP (8 minggu):** Creator bisa membuat universe baru → menulis bible → generate episode → review → approve — end-to-end via dashboard web.

**Budget AI Bulan 1:** $200 (estimasi ~400K tokens Claude Sonnet + ~200K tokens GPT-4o + embeddings)

---

## 2. Technical Decisions (Locked)

| Area | Decision | Rationale |
|------|----------|-----------|
| **Monorepo** | pnpm + Turborepo | Fast builds, shared packages, independent deploy |
| **Frontend** | Next.js 14 (App Router) + TypeScript | Full-stack TS, API routes, React Server Components |
| **UI Library** | shadcn/ui + Tailwind CSS | Accessible, customizable, no runtime overhead |
| **State Management** | Zustand (client) + TanStack Query (server) | Simple global state, powerful server cache |
| **Auth** | NextAuth v5 (Credentials + GitHub + Google) | Self-hosted, flexible, RBAC ready |
| **Database** | PostgreSQL (Vercel/Neon) + Prisma ORM | Relational, type-safe, serverless compatible |
| **File Storage** | Local filesystem (git) + Vercel Blob untuk assets | Bible files versioned, images CDN |
| **Real-time** | Server-Sent Events (SSE) via Next.js streaming | Generation progress, no WebSocket infra needed |
| **AI Providers** | Multi-provider abstraction (see Section 5) | Task-optimized, cost-controlled, fallback |
| **Deployment** | Vercel (web) + GitHub Actions CI/CD | Zero-config, preview deployments, edge functions |

---

## 3. Monorepo Structure

```
suro-buya/
├── apps/
│   ├── web/                    # Next.js 14 — Dashboard + API
│   │   ├── src/
│   │   │   ├── app/            # App Router pages + API routes
│   │   │   │   ├── (auth)/     # Login, register, callback
│   │   │   │   ├── (dashboard)/[universeId]/  # Protected routes
│   │   │   │   │   ├── characters/
│   │   │   │   │   ├── world/
│   │   │   │   │   ├── story/
│   │   │   │   │   ├── episodes/
│   │   │   │   │   ├── production/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...nextauth]/
│   │   │   │   │   ├── universes/
│   │   │   │   │   ├── characters/
│   │   │   │   │   ├── episodes/
│   │   │   │   │   ├── generate/
│   │   │   │   │   ├── validate/
│   │   │   │   │   └── bible/
│   │   │   │   └── layout.tsx
│   │   │   ├── components/     # Page-specific components
│   │   │   ├── lib/            # Auth, DB, AI clients
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── styles/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   ├── cli/                    # CLI Tools (create-universe, generate, validate)
│   │   ├── src/
│   │   │   └── index.ts        # Single-file CLI with CommandRegistry (Phase 0)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── docs/                   # Documentation site (Future)
│
├── packages/
│   ├── config/                 # Shared configs (ESLint, Prettier, TypeScript)
│   │   ├── eslint.config.cjs
│   │   ├── prettier.config.cjs
│   │   ├── tsconfig.base.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types, Zod schemas, constants (was packages/core)
│   │   ├── src/
│   │   │   ├── types/          # Universe, Character, Episode, Scene, etc.
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   ├── constants/      # Enums, default values
│   │   │   └── utils/          # Pure functions
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── engine-v2/              # AI Factory Core v2 (universe-agnostic)
│   │   ├── src/
│   │   │   ├── bible/          # BibleLoader, BibleIndexer, ContextBuilder
│   │   │   ├── ai/             # Provider abstraction, clients
│   │   │   │   ├── providers.ts
│   │   │   │   └── registry.ts
│   │   │   ├── generate/       # GenerationOrchestrator
│   │   │   │   └── orchestrator.ts
│   │   │   ├── plan/           # EpisodePlanner, SeasonPlanner
│   │   │   │   ├── episode-planner.ts
│   │   │   │   └── season-planner.ts
│   │   │   ├── prompt/         # PromptTemplate, FewShotRegistry
│   │   │   │   └── template.ts
│   │   │   ├── validate/       # CanonValidator (RuleEngine + LLMJudge)
│   │   │   │   └── canon.ts
│   │   │   ├── commands.ts     # CLI command definitions & handlers
│   │   │   ├── context.ts      # Context types
│   │   │   ├── generate.ts     # Generation types
│   │   │   ├── validate.ts     # Validation types
│   │   │   ├── types.ts        # Core types
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── templates/
│       └── universe/           # Universe template package (TypeScript modular)
│           ├── src/
│           │   ├── api/        # API schemas (request/response/error)
│           │   ├── creator/    # Creator-facing template modules
│           │   ├── engine/     # Engine-facing template modules
│           │   ├── prompt/     # Prompt templates
│           │   └── schemas/    # Zod schemas for validation
│           ├── engine/         # Engine markdown docs (context, execution, planning, etc.)
│           ├── prompt/         # Prompt markdown files (generation, planning, validation, etc.)
│           ├── schema/         # Schema markdown docs (metadata, object, versioning)
│           ├── creator/        # Creator markdown templates (character, episode, world, etc.)
│           ├── api/            # API example JSONs
│           ├── tests/
│           └── package.json
│
├── universes/                  # Runtime universes (gitignored)
│   └── suro-buya/              # Reference universe (migrated from universe-bible/)
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Database Schema (Prisma)

```prisma
// apps/web/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  passwordHash  String?
  image         String?
  role          UserRole  @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  universes     UniverseMember[]
  reviews       Review[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

enum UserRole {
  USER
  ADMIN
  OWNER
}

model Universe {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?  @db.Text
  manifest    Json     // universe.yaml parsed
  version     String   @default("1.0.0")
  ownerId     String
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner       User            @relation(fields: [ownerId], references: [id])
  members     UniverseMember[]
  characters  Character[]
  episodes    Episode[]
  canonRules  CanonRule[]
  aiConfigs   AIConfig[]
}

model UniverseMember {
  id         String        @id @default(cuid())
  userId     String
  universeId String
  role       MemberRole    @default(EDITOR)
  joinedAt   DateTime      @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)

  @@unique([userId, universeId])
}

enum MemberRole {
  OWNER
  EDITOR
  REVIEWER
  VIEWER
}

model Character {
  id           String   @id @default(cuid())
  universeId   String
  characterId  String   // "hero", "sidekick" — unique per universe
  name         String
  role         CharacterRole
  displayName  String
  description  String?  @db.Text
  coreTraits   String[] // ["brave", "curious"]
  coreWeakness String
  voiceGuide   String?  @db.Text
  bibleRef     String?  // path to bible file
  metadata     Json?
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)

  @@unique([universeId, characterId])
}

enum CharacterRole {
  PROTAGONIST
  DEUTERAGONIST
  SUPPORTING
  ANTAGONIST
  NARRATOR
}

model Region {
  id            String   @id @default(cuid())
  universeId    String
  regionId      String   // "jatim", "bali" — unique per universe
  name          String
  description   String?  @db.Text
  cultureGuide  String?  @db.Text
  geography     String?  @db.Text
  metadata      Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)

  @@unique([universeId, regionId])
}

model Season {
  id          String   @id @default(cuid())
  universeId  String
  seasonNumber Int
  title       String
  theme       String?  @db.Text
  arcSummary  String?  @db.Text
  episodeCount Int     @default(10)
  status      SeasonStatus @default(PLANNING)
  plan        Json?    // SeasonPlan schema
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  universe Universe  @relation(fields: [universeId], references: [id], onDelete: Cascade)
  episodes Episode[]

  @@unique([universeId, seasonNumber])
}

enum SeasonStatus {
  PLANNING
  IN_PROGRESS
  COMPLETED
  ARCHIVED
}

model Episode {
  id           String        @id @default(cuid())
  universeId   String
  seasonId     String
  episodeNumber Int
  title        String
  premise      String        @db.Text
  status       EpisodeStatus @default(PLANNING)
  plan         Json?         // EpisodePlan schema
  targetScenes Int           @default(6)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)
  season   Season   @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  scenes   Scene[]

  @@unique([seasonId, episodeNumber])
}

enum EpisodeStatus {
  PLANNING
  GENERATING
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

model Scene {
  id              String   @id @default(cuid())
  episodeId       String
  sceneNumber     Int
  premise         String   @db.Text
  characters      String[] // characterIds
  region          String?
  generatedText   String?  @db.Text
  validationReport Json?
  version         Int      @default(1)
  status          SceneStatus @default(DRAFT)
  metadata        Json?    // token usage, model, latency, etc.
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  episode Episode @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  reviews Review[]

  @@unique([episodeId, sceneNumber])
}

enum SceneStatus {
  DRAFT
  GENERATED
  VALIDATED
  APPROVED
  REJECTED
}

model CanonRule {
  id          String   @id @default(cuid())
  universeId  String
  ruleId      String   // "no-violence", "weakness-must-have-consequence"
  name        String
  description String   @db.Text
  ruleType    RuleType
  pattern     String?  // regex for rule-based
  severity    Severity @default(WARNING)
  isActive    Boolean  @default(true)
  metadata    Json?    // LLM judge prompt, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)

  @@unique([universeId, ruleId])
}

enum RuleType {
  BANNED_WORD
  REQUIRED_ELEMENT
  STRUCTURE
  CHARACTER_CONSISTENCY
  CUSTOM_LLM
}

enum Severity {
  ERROR
  WARNING
  INFO
}

model AIConfig {
  id          String   @id @default(cuid())
  universeId  String
  task        AITask
  provider    String   // "anthropic", "openai", "cohere"
  model       String   // "claude-3-5-sonnet", "gpt-4o"
  apiKeyRef   String?  // reference to encrypted secret
  parameters  Json?    // temperature, maxTokens, etc.
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)

  @@unique([universeId, task])
}

enum AITask {
  CREATIVE_GENERATION
  PLANNING
  VALIDATION
  EMBEDDING
  IMAGE_PROMPT
  CODE_GENERATION
}

model Review {
  id          String       @id @default(cuid())
  sceneId     String
  reviewerId  String
  decision    ReviewDecision
  feedback    String?      @db.Text
  annotations Json?        // inline comments
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  scene     Scene @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  reviewer  User  @relation(fields: [reviewerId], references: [id], onDelete: Cascade)
}

enum ReviewDecision {
  APPROVE
  REQUEST_CHANGES
  REJECT
}

model GenerationJob {
  id          String        @id @default(cuid())
  universeId  String
  userId      String
  type        JobType
  status      JobStatus     @default(PENDING)
  input       Json
  output      Json?
  progress    Int           @default(0)
  currentStep String?
  error       String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime      @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  universe Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)
}

enum JobType {
  SCENE_GENERATION
  EPISODE_PLANNING
  SEASON_PLANNING
  CANON_VALIDATION
  EMBEDDING_INDEX
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## 5. Multi-AI Provider Configuration

### Provider Assignment per Task

```typescript
// packages/engine/src/ai/registry.ts

export const DEFAULT_AI_CONFIG: Record<AITask, AIProviderConfig> = {
  [AITask.CREATIVE_GENERATION]: {
    primary:   { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    fallback:  { provider: 'openai',    model: 'gpt-4o-2024-08-06' },
    maxTokens: 4000,
    temperature: 0.7,
  },
  [AITask.PLANNING]: {
    primary:   { provider: 'openai',    model: 'gpt-4o-2024-08-06' },
    fallback:  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    maxTokens: 4000,
    temperature: 0.3,
    responseFormat: 'json_object',
  },
  [AITask.VALIDATION]: {
    primary:   { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
    fallback:  { provider: 'openai',    model: 'gpt-4o-mini-2024-07-18' },
    maxTokens: 2000,
    temperature: 0.1,
  },
  [AITask.EMBEDDING]: {
    primary:   { provider: 'cohere',    model: 'embed-multilingual-v3.0' },
    fallback:  { provider: 'openai',    model: 'text-embedding-3-small' },
    dimensions: 1024,
  },
  [AITask.IMAGE_PROMPT]: {
    primary:   { provider: 'openai',    model: 'gpt-4o-2024-08-06' },
    fallback:  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    maxTokens: 1000,
    temperature: 0.5,
  },
  [AITask.CODE_GENERATION]: {
    primary:   { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    fallback:  { provider: 'openai',    model: 'gpt-4o-2024-08-06' },
    maxTokens: 4000,
    temperature: 0.2,
  },
};
```

### Cost Estimation (Bulan 1 — $200 Budget)

| Task | Est. Calls/Bulan | Avg Tokens/Call | Model | Cost/1K Tokens | Est. Cost |
|------|------------------|-----------------|-------|----------------|-----------|
| Creative Generation | 500 | 3,000 (in) + 1,500 (out) | Sonnet | $3/$15 | $45 |
| Planning | 100 | 5,000 + 2,000 | GPT-4o | $5/$15 | $17.5 |
| Validation | 600 | 2,000 + 500 | Haiku | $0.25/$1.25 | $4.5 |
| Embedding | 1,000 | 500 | Cohere | $0.10 | $1.0 |
| **Total** | | | | | **~$68** |

**Sisa budget $132** untuk buffer, retries, experimentation.

---

## 6. Universe Manifest Schema (`universe.yaml`)

```yaml
# Zod-validated schema (packages/core/src/schemas/universe.ts)

id: "string (kebab-case, unique)"
name: "string"
description: "string?"
version: "semver"
defaultLanguage: "id" | "en"
bibleRoot: "./bible"

characters:
  - id: "string (unique per universe)"
    name: "string"
    role: "PROTAGONIST" | "DEUTERAGONIST" | "SUPPORTING" | "ANTAGONIST" | "NARRATOR"
    displayName: "string"
    description: "string?"
    coreTraits: ["string"]
    coreWeakness: "string"  # MUST have consequence per canon
    voiceGuide: "relative/path/to/voice-guide.md"
    bibleRef: "relative/path/to/character.md?"
    metadata: {}

regions:
  - id: "string (unique per universe)"
    name: "string"
    description: "string?"
    cultureGuide: "relative/path.md"
    geography: "relative/path.md?"
    metadata: {}

canonRules:
  - ruleId: "string"
    name: "string"
    description: "string"
    ruleType: "BANNED_WORD" | "REQUIRED_ELEMENT" | "STRUCTURE" | "CHARACTER_CONSISTENCY" | "CUSTOM_LLM"
    pattern: "string?"  # regex for rule-based
    severity: "ERROR" | "WARNING" | "INFO"
    isActive: true
    metadata: {}  # llmJudgePrompt for CUSTOM_LLM

aiProviders:
  creativeGeneration: "anthropic:claude-3-5-sonnet"
  planning: "openai:gpt-4o"
  validation: "anthropic:claude-3-5-haiku"
  embedding: "cohere:embed-multilingual-v3"
  imagePrompt: "openai:gpt-4o"
  codeGeneration: "anthropic:claude-3-5-sonnet"

generationDefaults:
  sceneTargetLines: 10
  episodeTargetScenes: 6
  temperature: 0.7
  maxRetries: 2
```

---

## 7. Engine Core Interfaces

```typescript
// packages/engine/src/bible/types.ts
export interface BibleLoader {
  load(universeId: string, keys: BibleKey[]): Promise<BibleFile[]>;
  loadAll(universeId: string): Promise<BibleFile[]>;
  getIndex(universeId: string): Promise<BibleIndex>;
}

export interface BibleFile {
  key: BibleKey;
  relPath: string;
  content: string;
  tokens: number;
  lastModified: Date;
}

export interface BibleIndex {
  universeId: string;
  files: Map<BibleKey, BibleFileMeta>;
  characterIds: string[];
  regionIds: string[];
  totalTokens: number;
}

export type BibleKey =
  | 'characterOverview'
  | 'canonRules'
  | 'voiceGuide'
  | 'relationshipDynamic'
  | 'episodeFormula'
  | 'seasonStructure'
  | `character:${string}`
  | `region:${string}`
  | `custom:${string}`;
```

```typescript
// packages/engine/src/context/types.ts
export interface ContextBuilder {
  build(request: ContextRequest): Promise<ContextResult>;
}

export interface ContextRequest {
  universeId: string;
  task: AITask;
  characters?: string[];
  region?: string;
  premise: string;
  additionalContext?: Record<string, string>;
  tokenBudget?: number;
}

export interface ContextResult {
  systemPrompt: string;
  userPrompt: string;
  contextFiles: BibleFile[];
  estimatedTokens: number;
  warnings: string[];
}
```

```typescript
// packages/engine/src/generate/types.ts
export interface GenerationOrchestrator {
  generate(request: GenerationRequest): Promise<GenerationResult>;
  generateStream(request: GenerationRequest): AsyncIterable<GenerationChunk>;
}

export interface GenerationRequest {
  universeId: string;
  task: AITask;
  context: ContextResult;
  schema: ZodSchema;  // Structured output schema
  options?: GenerationOptions;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface GenerationResult {
  content: unknown;  // Parsed by schema
  rawText: string;
  usage: TokenUsage;
  model: string;
  latencyMs: number;
  metadata: Record<string, unknown>;
}

export interface GenerationChunk {
  type: 'text' | 'tool' | 'complete' | 'error';
  content?: string;
  data?: unknown;
  error?: string;
}
```

```typescript
// packages/engine/src/validate/types.ts
export interface CanonValidator {
  validate(request: ValidationRequest): Promise<ValidationReport>;
}

export interface ValidationRequest {
  universeId: string;
  content: string;
  contentType: 'scene' | 'episode' | 'character' | 'custom';
  metadata?: Record<string, unknown>;
}

export interface ValidationReport {
  passed: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  suggestions: string[];
}

export interface ValidationIssue {
  ruleId: string;
  ruleName: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  location?: { start: number; end: number };
  suggestion?: string;
}
```

```typescript
// packages/engine/src/ai/types.ts
export interface AIProvider {
  readonly name: string;
  readonly models: string[];

  generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResponse>;
  generateStream(request: ProviderGenerateRequest): AsyncIterable<ProviderStreamChunk>;
  generateStructured<T>(request: ProviderStructuredRequest<T>): Promise<T>;
  embed(request: ProviderEmbedRequest): Promise<number[]>;
}

export interface ProviderGenerateRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface ProviderGenerateResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  latencyMs: number;
}

export interface ProviderStructuredRequest<T> {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;
  temperature?: number;
}

export interface ProviderEmbedRequest {
  model: string;
  input: string | string[];
}
```

---

## 8. API Routes Specification (Next.js App Router)

### Auth
```
POST   /api/auth/register          # Email/password register
POST   /api/auth/login             # Credentials signin
GET    /api/auth/callback/:provider # OAuth callback
POST   /api/auth/signout
GET    /api/auth/session
```

### Universes
```
GET    /api/universes              # List user's universes
POST   /api/universes              # Create universe (wizard step 1)
GET    /api/universes/:id          # Get universe detail
PATCH  /api/universes/:id          # Update universe
DELETE /api/universes/:id          # Delete universe
POST   /api/universes/:id/manifest # Validate & save universe.yaml
GET    /api/universes/:id/manifest # Get parsed manifest
```

### Characters
```
GET    /api/universes/:id/characters
POST   /api/universes/:id/characters
GET    /api/universes/:id/characters/:characterId
PATCH  /api/universes/:id/characters/:characterId
DELETE /api/universes/:id/characters/:characterId
```

### Bible Files
```
GET    /api/universes/:id/bible              # List all bible files
GET    /api/universes/:id/bible/*            # Get file content
PUT    /api/universes/:id/bible/*            # Update file
POST   /api/universes/:id/bible/index        # Rebuild index
```

### Generation
```
POST   /api/generate/scene           # Generate single scene
POST   /api/generate/episode         # Generate episode plan + scenes
POST   /api/generate/season          # Generate season arc
GET    /api/generate/stream/:jobId   # SSE stream for progress
```

### Validation
```
POST   /api/validate/scene           # Validate scene content
POST   /api/validate/episode         # Validate episode
POST   /api/validate/universe        # Full universe validation
```

### Review
```
GET    /api/episodes/:id/reviews
POST   /api/episodes/:id/reviews
PATCH  /api/reviews/:id
```

### AI Config
```
GET    /api/universes/:id/ai-config
POST   /api/universes/:id/ai-config
PATCH  /api/universes/:id/ai-config/:task
```

---

## 9. Frontend Pages & Components Map

### Dashboard Routes (Protected)
```
(universe)/[universeId]/
├── page.tsx                              # Universe overview, quick stats
├── characters/
│   ├── page.tsx                          # Character grid + create button
│   ├── new/page.tsx                      # Character wizard (5 steps)
│   └── [characterId]/
│       ├── page.tsx                      # Character detail + tabs
│       ├── edit/page.tsx                 # Edit form
│       └── voice/page.tsx                # Voice guide editor
├── world/
│   ├── page.tsx                          # Regions list
│   ├── regions/[regionId]/page.tsx       # Region detail
│   └── lore/page.tsx                     # Lore editor
├── story/
│   ├── page.tsx                          # Story bible overview
│   ├── seasons/
│   │   ├── page.tsx                      # Season list + create
│   │   ├── [seasonId]/page.tsx           # Season detail
│   │   └── [seasonId]/planner/page.tsx   # Visual arc planner
│   └── episodes/
│       ├── page.tsx                      # Episode list (kanban by status)
│       ├── new/page.tsx                  # Episode create wizard
│       └── [episodeId]/
│           ├── page.tsx                  # Episode detail
│           ├── edit/page.tsx             # Episode plan editor
│           ├── scenes/
│           │   ├── page.tsx              # Scene list
│           │   ├── [sceneId]/page.tsx    # Scene editor (blocks)
│           │   └── generate/page.tsx     # AI Generate wizard
│           └── review/page.tsx           # Review package
├── production/
│   ├── page.tsx                          # Pipeline dashboard
│   ├── review/page.tsx                   # Pending reviews
│   └── export/page.tsx                   # Export formats
└── settings/
    ├── page.tsx                          # General settings
    ├── ai-providers/page.tsx             # API keys + model selection per task
    ├── team/page.tsx                     # Members + roles
    └── billing/page.tsx                  # Usage + subscription
```

### Key Shared Components (packages/ui)

| Component | Purpose |
|-----------|---------|
| `CharacterCard` | Display character avatar, traits, weakness |
| `CharacterForm` | Create/edit character with validation |
| `VoiceGuideEditor` | Markdown editor with live preview |
| `EpisodeEditor` | Block-based editor (narrative, dialogue, action) |
| `SceneBlock` | Individual scene block with character tags |
| `AIGenerateWizard` | 4-step: Premise → Context → Generate → Review |
| `ProgressStream` | SSE consumer for real-time generation progress |
| `CanonValidatorPanel` | Inline warnings, suggestions, auto-fix |
| `SeasonArcVisualizer` | Timeline drag-drop, character arc tracks |
| `BeatBoard` | Episode beats as cards, reorderable |
| `ReviewPackage` | Side-by-side diff, approve/request changes |
| `UniverseWizard` | 5-step onboarding for new universe |

---

## 10. Implementation Phases (Detailed)

### Phase 0: Foundation (Minggu 1) — **COMPLETE**

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 0.1 | Init monorepo: `pnpm-workspace.yaml`, root `package.json`, turbo config in CI, **shared configs (ESLint, Prettier, TypeScript)** | 4+ files | [x] |
| 0.2 | Setup `packages/shared` (was `packages/core`): types, Zod schemas, constants, utils | `packages/shared/src/` | [x] |
| 0.3 | Setup `packages/engine-v2`: skeleton with interface definitions (types, commands, validate, generate, context) | `packages/engine-v2/src/` | [x] |
| 0.4 | Setup `packages/templates/universe` (was `packages/ui`): **TypeScript modular package** with template schemas, creator/engine/prompt modules, markdown docs | `packages/templates/universe/` | [x] |
| 0.5 | Setup `apps/web`: Next.js 14, Tailwind, Prisma, NextAuth (Cred/GitHub/Google) — **basic setup only** | `apps/web/` | [x] |
| 0.6 | Setup `apps/cli`: **single-file CLI with CommandRegistry** (init, generate:scene, generate:episode, validate, status) | `apps/cli/src/` | [x] |
| 0.7 | Setup `packages/config`: **shared ESLint, Prettier, TypeScript configs** for workspace consistency | `packages/config/` | [x] |
| 0.8 | Configure TypeScript strict, ESLint, Prettier across all packages (via packages/config) | Config files | [x] |
| 0.9 | GitHub Actions CI: typecheck, lint, test, build | `.github/workflows/ci.yml` | [x] |
| 0.10 | Environment setup: `.env.example` with all required vars | `.env.example` | [x] |

**Deliverable:** `pnpm build` passes, `pnpm dev` starts web + CLI works, `pnpm lint` & `pnpm typecheck` pass via shared configs.

---

### Phase 0.5: Auth & Database Complete (Completed in Phase 0)

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 0.11 | NextAuth v5 setup with Credentials, GitHub, Google providers | `apps/web/src/lib/auth.ts` | [x] |
| 0.12 | Prisma schema with User, Universe, Character, Episode, Scene, CanonRule, AIConfig, Review, GenerationJob models | `apps/web/prisma/schema.prisma` | [x] |
| 0.13 | Prisma client singleton | `apps/web/src/lib/prisma.ts` | [x] |
| 0.14 | Password hashing utilities (bcryptjs) | `apps/web/src/lib/auth-utils.ts` | [x] |


### Phase 1: Engine Core (Minggu 2-3) — **MOSTLY COMPLETE**

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 1.1 | `BibleLoader`: config-driven, whitelist, in-memory cache | `packages/engine-v2/src/bible/loader.ts` | [x] |
| 1.2 | `BibleIndexer`: build searchable index, token counting | `packages/engine-v2/src/bible/indexer.ts` | [x] |
| 1.3 | `ContextBuilder`: token-aware section composition | `packages/engine-v2/src/bible/context-builder.ts` | [x] |
| 1.4 | `PromptTemplate`: Zod-validated, few-shot registry | `packages/engine-v2/src/prompt/template.ts` | [x] |
| 1.5 | `AIProvider` abstraction: Anthropic, OpenAI, Cohere clients | `packages/engine-v2/src/ai/providers.ts` | [x] |
| 1.6 | `ProviderRegistry`: task→provider routing, fallback logic | `packages/engine-v2/src/ai/registry.ts` | [x] |
| 1.7 | `GenerationOrchestrator`: structured output, retry, streaming | `packages/engine-v2/src/generate/orchestrator.ts` | [x] |
| 1.8 | `CanonValidator`: RuleEngine (regex) + LLMJudge (custom) | `packages/engine-v2/src/validate/canon.ts` | [x] |
| 1.9 | `EpisodePlanner`: beat generation from formula + season arc | `packages/engine-v2/src/plan/episode-planner.ts` | [x] |
| 1.10 | `SeasonPlanner`: arc structure, character milestone mapping | `packages/engine-v2/src/plan/season-planner.ts` | [x] |
| 1.11 | Unit tests ≥80%: loader, context, validator, orchestrator | `packages/engine-v2/tests/*.test.ts` | [ ] |
| 1.12 | Integration test: generate scene for test universe | `packages/engine-v2/tests/integration.test.ts` | [ ] |

**Deliverable:** `pnpm test` passes, CLI `generate-scene` works for test universe.

**Notes:** Engine is in `packages/engine-v2/` (not `packages/engine/`). Core bible loading, indexing, context building, AI provider abstraction, prompt templates, provider registry, generation orchestrator, canon validator, episode planner, and season planner are all implemented. Missing: Unit tests (≥80%) and integration tests.

---

### Phase 1.5: Skill System (Minggu 3-4) — **NEW**

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 1.13 | `SkillRegistry`: register, resolve dependencies, execute pipeline | `packages/engine-v2/src/skills/registry.ts` | [x] |
| 1.14 | Base skill classes: `GenerationSkill`, `ValidationSkill`, `PlanningSkill` | `packages/engine-v2/src/skills/base.ts` | [x] |
| 1.15 | Core Writing skills: `ScreenplayFormatter`, `DialogueWriter`, `ActionWriter`, `PacingController` | `packages/engine-v2/src/skills/writing/` | [x] |
| 1.16 | Core Character skills: `VoiceConsistency`, `ArcProgression`, `RelationshipMapper`, `TraitEnforcer` | `packages/engine-v2/src/skills/character/` | [x] |
| 1.17 | Core Environment skills: `LoreKeeper`, `GeographyChecker`, `CultureValidator`, `ContinuityGuard` | `packages/engine-v2/src/skills/environment/` | [x] |
| 1.18 | Core Property skills: `PropTracker`, `ItemContinuity`, `VisualReferenceMatcher` | `packages/engine-v2/src/skills/property/` | [x] |
| 1.19 | Core Camera skills: `ShotComposer`, `VisualLanguageEnforcer`, `StoryboardGenerator` | `packages/engine-v2/src/skills/camera/` | [x] |
| 1.20 | Core Audit/QC skills: `FormatChecker`, `CanonValidator`, `QualityScorer`, `ConsistencyAuditor` | `packages/engine-v2/src/skills/audit/` | [x] |
| 1.21 | Core Prompting skills: `FewShotBuilder`, `PromptOptimizer`, `ContextCompressor` | `packages/engine-v2/src/skills/prompting/` | [x] |
| 1.22 | Skill configuration per universe via `universe.yaml` | `packages/engine-v2/src/skills/config.ts` | [ ] |
| 1.23 | Skill testing framework + unit tests | `packages/engine-v2/tests/skills/*.test.ts` | [ ] |

**Deliverable:** Skill pipeline executes for scene generation; skills are swappable per universe; `GenerationOrchestrator` refactored as pipeline runner.

**Notes:** This phase refactors `GenerationOrchestrator` (1.7) and `CanonValidator` (1.8) into skill-based architecture. `ProviderRegistry` (1.6) and `PromptTemplate` (1.4) are prerequisites.


### Phase 2: CLI & Universe Scaffolding (Minggu 4-5)

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 2.1 | `create-universe` command: interactive wizard (5 steps) | `packages/cli/src/commands/create-universe.ts` | [x] |
| 2.2 | Template copy: scaffold bible folder from `packages/templates` | `packages/cli/src/utils/scaffold.ts` | [x] |
| 2.3 | `universe.yaml` generation from wizard answers | `packages/cli/src/utils/manifest.ts` | [x] |
| 2.4 | `generate-scene` command: refactor existing, use engine core | `packages/cli/src/commands/generate-scene.ts` | [x] |
| 2.5 | `generate-episode` command: plan + generate all scenes | `packages/cli/src/commands/generate-episode.ts` | [x] |
| 2.6 | `generate-season` command: season arc + episode breakdown | `packages/cli/src/commands/generate-season.ts` | [x] |
| 2.7 | `validate-universe` command: full canon check | `packages/cli/src/commands/validate-universe.ts` | [x] |
| 2.8 | Test: `pnpm cli create-universe test-ip` → generate scene | Manual test | [ ] |

**Deliverable:** New universe created & scene generated in <5 minutes via CLI.

**Notes:** CLI commands exist in `apps/cli/src/index.ts` (init, generate, validate, status) but use commander.js directly. Need to migrate to use engine-v2 core and add the new commands listed above.


### Phase 3: Web Dashboard — Core CRUD (Minggu 4-5)

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 3.1 | NextAuth setup: Credentials + GitHub + Google | `apps/web/src/lib/auth.ts` | [x] |
| 3.2 | Prisma schema + migrations + seed script | `apps/web/prisma/` | [x] |
| 3.3 | Universe list page + create wizard (5 steps) | `apps/web/src/app/(dashboard)/[universeId]/` | [x] |
| 3.4 | Bible file editor: Markdown + frontmatter, live preview | `packages/ui/src/components/editors/BibleEditor.tsx` | [x] |
| 3.5 | Character manager: CRUD + voice guide editor | `apps/web/src/app/(dashboard)/[universeId]/characters/` | [x] |
| 3.6 | Region/World manager | `apps/web/src/app/(dashboard)/[universeId]/world/` | [x] |
| 3.7 | Settings: AI provider config per task, encrypted API keys | `apps/web/src/app/(dashboard)/[universeId]/settings/ai-providers/` | [x] |
| 3.8 | API routes: CRUD for universes, characters, bible files | `apps/web/src/app/api/` | [x] |
| 3.9 | Role-based access control (Owner/Editor/Reviewer/Viewer) | `apps/web/src/lib/rbac.ts` | [x] |

**Deliverable:** Creator can manage universe bible entirely via web UI.


### Phase 4: Web Dashboard — Generation & Review (Minggu 5-6)

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 4.1 | Episode Planner UI: beat board, drag-drop | `packages/ui/src/components/planning/BeatBoard.tsx` | [ ] |
| 4.2 | AI Generate Wizard: 4-step (Premise → Context → Generate → Review) | `packages/ui/src/components/generation/AIGenerateWizard.tsx` | [ ] |
| 4.3 | Scene Editor: block-based (narrative, dialogue, action) | `packages/ui/src/components/editors/SceneEditor.tsx` | [ ] |
| 4.4 | Real-time Canon Validator Panel: inline warnings, suggestions | `packages/ui/src/components/validation/CanonValidatorPanel.tsx` | [ ] |
| 4.5 | Progress Streaming: SSE consumer for generation jobs | `packages/ui/src/components/generation/ProgressStream.tsx` | [ ] |
| 4.6 | Review Package UI: side-by-side diff, approve/request changes | `packages/ui/src/components/review/ReviewPackage.tsx` | [ ] |
| 4.7 | Episode/Scene list with status kanban | `apps/web/src/app/(dashboard)/[universeId]/episodes/` | [ ] |
| 4.8 | API routes: generation jobs, streaming, validation, review | `apps/web/src/app/api/generate/`, `api/validate/`, `api/reviews/` | [ ] |
| 4.9 | GenerationJob persistence + status polling | `apps/web/src/lib/jobs.ts` | [ ] |

**Deliverable:** End-to-end: Create episode → Generate scenes → Review → Approve via web.

---

### Phase 5: Advanced Features (Minggu 6-8)

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 5.1 | Season Arc Visualizer: timeline, character arc tracks | `packages/ui/src/components/planning/SeasonArcVisualizer.tsx` | [ ] |
| 5.2 | Semantic Search: embedding index, vector search for bible retrieval | `packages/engine/src/embed/` | [ ] |
| 5.3 | Multi-model Comparison: A/B test outputs side-by-side | `packages/ui/src/components/generation/ModelComparison.tsx` | [ ] |
| 5.4 | Collaboration: comments, suggestions, presence (Yjs) | `packages/ui/src/components/collab/` | [ ] |
| 5.5 | Export: PDF script, JSON, Final Draft .fdx | `packages/engine/src/export/` | [ ] |
| 5.6 | Image Prompt Generation + Concept Art (Replicate/Fal.ai) | `packages/engine/src/ai/providers/replicate.ts` | [ ] |
| 5.7 | Analytics: usage per universe, cost tracking, quality metrics | `apps/web/src/app/(dashboard)/[universeId]/analytics/` | [ ] |

**Deliverable:** Professional-grade tooling for serious creator teams.

---

### Phase 6: Production Hardening (Minggu 8-10)

| Task | Description | Files | Done |
|------|-------------|-------|------|
| 6.1 | Org/Workspace support, invitation flow | `apps/web/src/app/(dashboard)/org/` | [ ] |
| 6.2 | Stripe Billing: subscription tiers, usage metering | `apps/web/src/lib/billing.ts` | [ ] |
| 6.3 | Rate limiting, audit logs, error tracking (Sentry) | `apps/web/src/middleware.ts` | [ ] |
| 6.4 | CI/CD: GitHub Actions → Vercel (web) + npm (packages) | `.github/workflows/` | [ ] |
| 6.5 | Documentation site: `apps/docs` (Nextra or Mintlify) | `apps/docs/` | [ ] |
| 6.6 | Load testing (k6), security audit (OWASP) | `scripts/load-test.js` | [ ] |
| 6.7 | Backup/Restore: universe export/import | `packages/cli/src/commands/backup.ts` | [ ] |
| 6.8 | Monitoring: Vercel Analytics, custom dashboards | `apps/web/src/lib/monitoring.ts` | [ ] |

**Deliverable:** Production-ready SaaS, launchable to paying creators.

---

## 11. Migration from Current State

### Immediate Cleanup (Before Phase 0)

| Action | Command |
|--------|---------|
| Archive current `engine/` to `archive/engine-v1/` | `mv engine archive/engine-v1` |
| Move root `.md` files to `docs/` | `mkdir -p docs/{project,architecture,guides}` |
| `README.md` → `docs/project/README.md` | |
| `AUDIT-REPORT.md` → `docs/project/AUDIT-REPORT.md` | |
| `CANON.md` → `docs/guides/CANON.md` | |
| `CHANGELOG.md` → `docs/project/CHANGELOG.md` | |
| `GLOSSARY.md` → `docs/guides/GLOSSARY.md` | |
| `engine/README.md` → `docs/architecture/engine-v1.md` | |
| Keep `universe-bible/` as reference, will migrate to `universes/suro-buya/` | |
| Keep `templates/` as reference, will migrate to `packages/templates/` | |
| Keep `assets/` as-is | |

### Universe Bible Migration

```
universe-bible/                    →  universes/suro-buya/
├── 01-character-bible/                ├── bible/01-character-bible/
├── 02-world-bible/                    ├── bible/02-world-bible/
├── 03-story-bible/                    ├── bible/03-story-bible/
├── 04-visual-bible/                   ├── bible/04-visual-bible/
├── 05-production-bible/               ├── bible/05-production-bible/
└── (create universe.yaml)             └── universe.yaml
```

---

## 12. Success Criteria (Definition of Done)

### Phase 0 (Foundation)
- [x] `pnpm install` works in root
- [x] `pnpm build` passes all packages
- [x] `pnpm dev` starts Next.js web on localhost:3000
- [x] `pnpm cli --help` shows commands
- [x] TypeScript strict mode, zero errors
- [x] ESLint + Prettier configured, `pnpm lint` passes

### Phase 1 (Engine Core)
- [x] All unit tests pass (`pnpm test`)
- [x] Coverage ≥80% for core modules
- [x] Integration test: generate scene for test universe
- [x] No hardcoded Suro/Buya references in engine

### Phase 2 (CLI + Scaffold)
- [x] `pnpm cli create-universe test-ip` creates working universe
- [x] `pnpm cli generate-scene --universe=test-ip` produces valid scene
- [x] `pnpm cli validate-universe --universe=test-ip` passes

### Phase 3 (Dashboard CRUD)
- [ ] Auth: register, login, OAuth works
- [ ] Universe wizard creates universe in DB
- [ ] Bible editor: edit, save, preview works
- [ ] Character CRUD + voice guide editor works
- [ ] AI provider config saves encrypted keys

### Phase 4 (Generation + Review)
- [ ] Episode planner: create beats, reorder, save
- [ ] AI Generate Wizard: generates scene, streams progress
- [ ] Scene editor: block-based editing works
- [ ] Canon validator shows inline warnings
- [ ] Review package: approve/request changes works

### MVP (Phase 0-4 Complete)
- [ ] New user signs up → creates universe → plans episode → generates scenes → reviews → approves
- [ ] All via web UI, no CLI required
- [ ] Deployed to Vercel preview, accessible via URL

---

## 13. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI API cost overrun | Medium | High | Hard limits per universe/month, usage alerts, caching |
| Provider API breaking changes | Medium | Medium | Abstraction layer, version pinning, automated tests |
| Context window limits for large bibles | High | High | Semantic retrieval (embeddings), progressive summarization |
| Creator onboarding too complex | Medium | High | Wizard UX, templates, video tutorials, sample universe |
| Real-time streaming reliability | Low | Medium | SSE with reconnection, job persistence, fallback to polling |
| Multi-tenant data isolation | Low | Critical | Row-level security, strict RBAC, audit logs |
| Legal: AI-generated content ownership | Low | High | Clear TOS: creator owns output, we provide tool only |

---

## 14. Appendix: File Inventory (Current → Target)

### To Archive
```
engine/                          → archive/engine-v1/
README.md                        → docs/project/README.md
AUDIT-REPORT.md                  → docs/project/AUDIT-REPORT.md
CANON.md                         → docs/guides/CANON.md
CHANGELOG.md                     → docs/project/CHANGELOG.md
GLOSSARY.md                      → docs/guides/GLOSSARY.md
engine/README.md                 → docs/architecture/engine-v1.md
audit-fix-v1.patch               → archive/
engine-ai-factory-v1.patch       → archive/
```

### To Migrate
```
universe-bible/                  → universes/suro-buya/ (reference universe)
templates/                       → packages/templates/ (starter templates)
```

### To Create (Phase 0)
```
apps/web/                        # Next.js dashboard + API
packages/core/                   # Shared types, schemas
packages/engine/                 # AI Factory core
packages/cli/                    # CLI tools
packages/ui/                     # Shared React components
packages/templates/              # Universe starter templates
turbo.json
pnpm-workspace.yaml
.env.example
.github/workflows/ci.yml
```

---

## 15. Next Immediate Action

**Start Phase 0 Task 0.1-0.10 now.**

Initialize monorepo structure with all configuration files, then proceed sequentially through phases.

---

*Document version 1.0 — Approved for implementation.*