# Suro-Buya Universe — AI Factory Multi-Universe

> **Monorepo untuk pengembangan IP Universe anak-anak Indonesia (Suro & Buya) dengan AI Factory yang production-ready.**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.14+-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 Tentang Project

**Suro-Buya Universe** adalah platform AI Factory untuk menciptakan, mengelola, dan memproduksi *IP Universe* anak-anak Indonesia secara end-to-end. Mulai dari pembuatan *universe bible* (character, world, story, visual, production), perencanaan season/episode, generasi scene via AI, validasi kanonisasi, hingga review & approve — semua dalam satu platform terintegrasi.

### Universe Referensi: **Suro & Buya**
- **Suro** — Hiu muda, laki-laki, 10 th, asal Surabaya, penasaran, berani, suka petualangan (*The Explorer Leader*)
- **Buya** — Buaya muda, laki-laki, 9 th, asal Surabaya, rasa ingin tahu besar, suka memahami sebelum bertindak (*The Curious Explorer*)
- **Setting**: Nusantara modern-fantasy, budaya Jawa-Timur kaya makna
- **Target**: Anak 7–12 tahun, keluarga Indonesia

---

## 🏗 Arsitektur Monorepo

```
suro-buya/
├── apps/
│   ├── web/                    # Next.js 14 — Dashboard + API (Creator Portal)
│   │   ├── src/app/            # App Router pages & API routes
│   │   ├── src/lib/            # Auth, DB, AI clients
│   │   ├── src/components/     # Page-specific components
│   │   └── prisma/             # Database schema
│   │
│   └── cli/                    # CLI Executable Application (@suro-buya/cli)
│       └── src/
│
├── packages/
│   ├── shared/                 # Shared types, Zod schemas, constants, utils
│   │   └── src/types/, schemas/, constants/, utils/
│   │
│   ├── cli/                    # CLI Commands Library (@suro-buya/cli-commands)
│   │   └── src/commands/, utils/
│   │
│   ├── engine-v2/              # AI Factory Core (universe-agnostic)
│   │   ├── src/
│   │   │   ├── bible/          # BibleLoader, BibleIndexer, ContextBuilder
│   │   │   ├── prompt/         # PromptTemplate, FewShotRegistry
│   │   │   ├── generate/       # GenerationOrchestrator, StreamingHandler
│   │   │   ├── validate/       # CanonValidator (RuleEngine + LLMJudge)
│   │   │   ├── plan/           # EpisodePlanner, SeasonPlanner
│   │   │   ├── ai/             # Provider abstraction (Anthropic, OpenAI, Cohere)
│   │   │   ├── embed/          # EmbeddingService, VectorStore
│   │   │   └── events/         # EventEmitter for progress streaming
│   │   └── tests/
│   │
│   ├── templates/              # Universe starter templates
│   │   └── universe/
│   │       ├── universe.yaml.template
│   │       └── bible/          # 5 bible categories templates
│   │
│   └── config/                 # Shared ESLint, TypeScript, Prettier configs
│
├── universes/                  # Runtime universes (gitignored)
│   └── suro-buya/              # Reference universe (migrated from universe-bible/)
│
├── docs/                       # Documentation (architecture, guides, specs)
│   ├── 00-foundation/          # Technical decisions, ADRs
│   ├── 01-creator/             # Creator workflow guides
│   ├── 02-engine/              # Engine internals
│   ├── 03-production/          # Production ops
│   └── ...
│
├── turbo.json                  # Turborepo pipeline config
├── package.json                # Root scripts & workspaces
├── pnpm-workspace.yaml
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL (atau Supabase)

### Instalasi

```bash
# Clone repository
git clone https://github.com/adminberitakarya-Aji/sura-buya.git
cd sura-buya

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env

# Setup database
pnpm --filter @suro-buya/web db:generate
pnpm --filter @suro-buya/web db:push

# Build semua packages
pnpm build

# Development
pnpm dev          # Start web dev server (Next.js)
pnpm --filter @suro-buya/cli dev  # CLI development mode
```

### Perintah Berguna

```bash
# Development
pnpm dev                    # Web dashboard di http://localhost:3000
pnpm build                  # Build semua packages
pnpm build:engine           # Build engine-v2 saja
pnpm build:web              # Build web app saja

# Database
pnpm --filter @suro-buya/web db:studio    # Prisma Studio
pnpm --filter @suro-buya/web db:seed      # Seed database

# Testing & Quality
pnpm test                   # Jalankan semua test
pnpm lint                   # Lint semua packages
pnpm typecheck              # TypeScript check
pnpm format                 # Prettier format

# CLI Commands
pnpm --filter @suro-buya/cli create-universe
pnpm --filter @suro-buya/cli generate:scene
pnpm --filter @suro-buya/cli generate:episode
pnpm --filter @suro-buya/cli validate:universe
```

---

## 📦 Packages Overview

| Package | Deskripsi | Entry Point |
|---------|-----------|-------------|
| `@suro-buya/shared` | Shared types, Zod schemas, constants, utilities | `packages/shared/src/index.ts` |
| `@suro-buya/engine-v2` | AI Factory core: bible, context, prompt, generate, validate, plan, ai | `packages/engine-v2/src/index.ts` |
| `@suro-buya/cli-commands` | CLI commands & utilities library | `packages/cli/src/index.ts` |
| `@suro-buya/templates` | Universe starter templates (creator/engine/prompt modules) | `packages/templates/universe/` |
| `@suro-buya/config` | Shared ESLint, TypeScript, Prettier configs | `packages/config/` |
| `@suro-buya/web` | Next.js 14 Dashboard + API (Creator Portal) | `apps/web/` |
| `@suro-buya/cli` | Executable CLI tools untuk universe management | `apps/cli/src/index.ts` |

---

## 🔐 Environment Variables

Salin `.env.example` ke `.env` dan isi:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/surobuya?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# AI Providers
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
COHERE_API_KEY=""

# File Storage
BIBLE_ROOT_PATH="./universes"
```

---

## 🏃‍♂️ Workflow Creator (End-to-End)

```mermaid
graph LR
    A[Create Universe] --> B[Write Bible]
    B --> C[Plan Season]
    C --> D[Plan Episode]
    D --> E[Generate Scene]
    E --> F[Validate Canon]
    F --> G[Review & Approve]
    G --> H[Export/Publish]
```

1. **Create Universe** — Wizard 5 langkah: manifest, characters, world, story, settings
2. **Write Bible** — Editor markdown untuk 5 kategori bible (character, world, story, visual, production)
3. **Plan Season** — Arc visualizer, character milestones, episode beats
4. **Plan Episode** — Beat board, scene breakdown, target scenes
5. **Generate Scene** — AI generation dengan context-aware prompts, streaming progress
6. **Validate Canon** — Rule engine (regex) + LLM Judge untuk konsistensi karakter & larangan
7. **Review & Approve** — Side-by-side diff, annotate, approve/request changes/reject
8. **Export** — Markdown, JSON, PDF, atau publish ke platform

---

## 🤖 AI Provider Configuration

| Task | Primary | Fallback | Use Case |
|------|---------|----------|----------|
| Creative Generation | Claude 3.5 Sonnet | GPT-4o | Scene writing, dialogue |
| Planning | GPT-4o | Claude 3.5 Sonnet | Season/episode planning, JSON output |
| Validation | Claude 3.5 Haiku | GPT-4o-mini | Canon checking, fast & cheap |
| Embedding | Cohere v3 | OpenAI text-emb-3-small | Bible indexing, semantic search |
| Image Prompt | GPT-4o | Claude 3.5 Sonnet | Visual prompt generation |
| Code Generation | Claude 3.5 Sonnet | GPT-4o | Template code, scripts |

**Budget Bulan 1**: ~$68 dari $200 (lihat `IMPLEMENTATION-PLAN.md` Section 5)

---

## 📚 Dokumentasi

| Dokumen | Deskripsi |
|---------|-----------|
| `IMPLEMENTATION-PLAN.md` | Rencana implementasi detail 8 minggu (Phase 0-4) |
| `docs/00-foundation/` | Keputusan teknis, ADR, glossary |
| `docs/01-creator/` | Panduan workflow creator |
| `docs/02-engine/` | Arsitektur engine, interfaces |
| `docs/07-engine-spec/` | Spec teknis engine core |
| `docs/08-implementation-design/` | Desain implementasi per fase |

---

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Integration tests (engine-v2)
pnpm --filter @suro-buya/engine-v2 test:integration
```

Target coverage: **≥80%** untuk engine core (loader, context, validator, orchestrator).

---

## 🚢 Deployment

### Vercel (Web App)
```bash
# Connect repo ke Vercel, set environment variables
# Auto-deploy on push to main
```

### Database
- **Development**: Local PostgreSQL / Docker
- **Production**: Vercel Postgres / Neon / Supabase

### CI/CD (GitHub Actions)
- `.github/workflows/ci.yml` — Typecheck, lint, test, build
- `.github/workflows/deploy.yml` — Deploy to Vercel on merge

---

## 🤝 Contributing

1. Fork repository
2. Buat branch: `git checkout -b feature/nama-fitur`
3. Commit changes: `git commit -m "feat: tambah fitur X"`
4. Push: `git push origin feature/nama-fitur`
5. Buat Pull Request

### Commit Convention
Mengikuti [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — Fitur baru
- `fix:` — Bug fix
- `docs:` — Dokumentasi
- `refactor:` — Refactor code
- `test:` — Test
- `chore:` — Maintenance

---

## 📄 License

**MIT License** — lihat file [LICENSE](LICENSE) untuk detail.

---

## 🙏 Acknowledgments

- **Anthropic** — Claude models untuk creative generation & validation
- **OpenAI** — GPT-4o untuk planning & image prompts
- **Cohere** — Multilingual embeddings untuk bahasa Indonesia
- **Vercel** — Hosting, Postgres, Blob storage
- **shadcn/ui** — Komponen UI accessible & customizable
- **Turborepo** — Monorepo build system

---

## 📞 Kontak

- **Repository**: https://github.com/adminberitakarya-Aji/sura-buya
- **Issues**: GitHub Issues untuk bug reports & feature requests
- **Discussions**: GitHub Discussions untuk pertanyaan & ide

---

> **Dibangun dengan ❤️ untuk anak-anak Indonesia** — *Suro & Buya hadir membawa petualangan Nusantara ke era AI.*