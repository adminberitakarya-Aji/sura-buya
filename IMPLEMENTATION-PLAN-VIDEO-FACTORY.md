# Implementation Plan — AI Video Factory (Sura & Buya)

> **Status:** Draft — menunggu konfirmasi untuk mulai VF-1
> **Created:** 2026-08-02
> **Version:** 2.1 (revisi: platform generik lintas audiens — Suro & Buya jadi salah satu contoh universe, bukan asumsi default; lihat `REDESIGN-VIDEO-FACTORY.md` Prinsip #4)
> **Dokumen terkait:** `REDESIGN-VIDEO-FACTORY.md` (audit, arsitektur, keputusan tools)
> **Penomoran phase:** Sengaja diberi prefix **VF-** (bukan "Phase 1..6" polos) supaya tidak bentrok dengan Phase 5-6 di `IMPLEMENTATION-PLAN.md` (platform teks) yang sedang berjalan.
> **Prinsip migrasi:** *Extend, don't replace.* Fondasi existing (`Character`, `CanonValidator`, `ContextBuilder`, RBAC, auth) tidak dihapus atau ditulis ulang dari nol — tetapi **diperluas/diadaptasi non-breaking** di mana pun struktur data baru (`CharacterAsset`, `VideoSeries`, `ContentRating`) atau alur baru (persona wizard, media pipeline) menuntutnya, sambil menjaga semantik canon yang sudah ada.

---

## 1. Executive Summary

Menambahkan kemampuan generate video pendek (MP4 9:16, 15-60 detik) di atas Character Bible yang sudah ada, dengan karakter yang bisa dibuat baru (persona lengkap) dan dipakai lintas beberapa episode/cerita berbeda. **Platform ini generik untuk audiens umum** — setiap universe (termasuk Suro & Buya) mendeklarasikan `contentRating`-nya sendiri, tidak ada asumsi audiens tertentu di level engine.

**Target MVP (VF-1 s/d VF-5, ~11 minggu):** User bisa buat karakter baru (persona + visual + voice) → pilih standalone atau bagian dari series → input naskah per episode → sistem generate storyboard, visual, motion, audio → compose jadi video 9:16 → lolos canon + content moderation review → export siap upload.

---

## 2. Technical Decisions (Locked)

| Area | Keputusan |
|---|---|
| Persona Input | Free-text (default) → AI strukturisasi → **form review wajib** sebelum di-lock jadi Character Bible entry. Form manual tetap tersedia sebagai opsi alternatif di Step 1 |
| Audiens/Rating | Per-universe (`Universe.contentRating`: ALL_AGES/TEEN/MATURE + `audienceProfile` bebas teks) — **tidak ada default hardcode di engine**, `persona-parser.ts` sudah menerima ini sebagai parameter opsional |
| Relasi Karakter-Video | `CharacterAsset` 1:1 ke `Character` existing (bukan tabel persona terpisah) |
| Continuity Multi-Episode | `VideoSeries` menaungi beberapa `VideoProject`; `ContextBuilder` existing di-reuse untuk konteks lintas episode |
| Canon untuk Video | `CanonValidator` existing di-reuse — cek persona-vs-bible dan continuity-vs-episode sebelumnya, terpisah dari content moderation |
| Video Rendering | Remotion (composition) + FFmpeg (encode) |
| Character Visual Consistency | Reference-image conditioning (default) — LoRA di-defer ke VF-6 (opsional) |
| Video Gen Provider | Kling 3.0 (primary) → Seedance 2 → Wan 2.7 (fallback chain) |
| TTS | ElevenLabs/Cartesia (primary, wajib uji kualitas Bahasa Indonesia untuk rentang suara yang dibutuhkan tiap universe) + IndoTTS (fallback) |
| Orchestration | Temporal |
| Storage | S3-compatible (R2/Tigris) |

---

## 3. Total Timeline Overview

| Phase | Fokus | Estimasi | Kumulatif |
|---|---|---|---|
| VF-1 | Foundation & Character System (persona + bible link) | 9 hari kerja | Minggu 1-2 |
| VF-2 | Script → Storyboard (+ Series/continuity) | 8.5 hari kerja | Minggu 2-3 |
| VF-3 | Visual + Motion Generation | 10 hari kerja | Minggu 3-5 |
| VF-4 | Audio + Composition | 8 hari kerja | Minggu 5-6 |
| VF-5 | Canon+Safety, Batch & Platform Export | 10 hari kerja | Minggu 6-8 |
| VF-6 | Advanced & Polish (post-MVP) | 12 hari kerja | Minggu 8-11 |

**Total MVP (VF-1 s/d VF-5): ~45 hari kerja, dibulatkan ~11 minggu dengan buffer.**

---

## 4. VF-1 — Foundation & Character System

**Durasi: 9 hari kerja | Prasyarat: tidak ada**

### Task Breakdown

| # | Task | Deskripsi | Files | Est. |
|---|---|---|---|---|
| VF-1.1 | ✅ Extend `packages/shared/src/types/` | `MediaJob`, `CharacterVisualProfile`, `ShotSpec`, `VideoAsset`, `PersonaDraft` — **selesai & terverifikasi** (tsc/lint/test lolos, 0 regresi ke 14 test existing `packages/shared`) | `packages/shared/src/types/video.ts` | 0.5 hari |
| VF-1.2 | ✅ `character/persona-parser.ts` | Free-text → `PersonaDraft` terstruktur via Claude, menerima `audienceProfile` opsional dari universe pemanggil (tidak hardcode asumsi audiens) — **selesai & terverifikasi**, 13 test lolos, 0 regresi ke 73 test existing `engine-v2` | `packages/engine-v2/src/character/persona-parser.ts` | 1.5 hari |
| VF-1.3 | ✅ Prisma migration: `CharacterAsset` (relasi 1:1 ke `Character`) + `VideoSeries` + extend `Universe` | Skema sesuai `REDESIGN-VIDEO-FACTORY.md` §2.3. **Selesai & terverifikasi penuh** — `prisma db push` sukses ke database production, `prisma generate` sukses, dan seluruh 202 test `apps/web` existing lolos tanpa regresi. Catatan: dipakai `db push` (bukan `migrate dev`) karena riwayat migration project ini memang berbasis `db push` sejak fitur Collaboration (lihat `TASK-5.4-COLLABORATION.md`) — konsisten dengan cara project berkembang selama ini | `apps/web/prisma/schema.prisma` | 1 hari |
| VF-1.4 | ✅ `ai/media-providers/` skeleton | Interface `ImageProvider`/`VideoProvider`/`VoiceProvider` + `MediaProviderRegistry` dengan **fallback CHAIN** (bukan primary/fallback tunggal seperti `ai/registry.ts` teks) — langsung mendukung pola 3-tingkat Kling→Seedance→Wan yang sudah locked. Mock provider untuk testing, implementasi nyata menyusul di VF-3.1/3.3/4.1. **Selesai & terverifikasi** — 7 test baru (termasuk simulasi chain 3-tingkat), 0 regresi (93/93 total) | `packages/engine-v2/src/ai/media-providers/` | 1 hari |
| VF-1.5 | ✅ `character/character-builder.ts` | Terima `PersonaDraft` yang sudah di-approve user → petakan ke `CharacterCreateInput`/`CharacterAssetCreateInput` siap-simpan — **murni fungsi transformasi, TIDAK menyentuh Prisma** (konsisten dengan pola `db-context.ts` existing: engine-v2 tidak pernah akses DB langsung, semua write terjadi di `apps/web`). Field tanpa kolom Prisma langsung (species, ageDescriptor, motivation, visualDescription) masuk ke `Character.metadata` (Json, sudah ada di schema). **Sekaligus memperbaiki gap:** `persona-parser.ts` (VF-1.2) dan `ai/media-providers/` (VF-1.4) ternyata belum terdaftar di barrel export `src/index.ts` sejak awal — sudah diperbaiki di commit ini. **Selesai & terverifikasi** — 6 test baru, build ESM+CJS sukses, smoke-test `dist/index.js` via ESM import berhasil, 99/99 total | `packages/engine-v2/src/character/character-builder.ts`, `packages/engine-v2/src/index.ts` (edit) | 1 hari |
| VF-1.6 | ✅ `character/reference-generator.ts` | Generate 3-5 reference image (turnaround: depan/samping/full-body/ekspresi) dari persona final secara provider-agnostic via `ImageProvider` / `MediaProviderRegistry` — **selesai & terverifikasi**, 6 test baru, build ESM+CJS sukses, 0 regresi (111/111 total test engine-v2) | `packages/engine-v2/src/character/reference-generator.ts` | 1 hari |
| VF-1.7 | ✅ Wizard "Create New Character" — 2 Step (+ Step 3 Visual Reference) | **Step 1:** toggle free-text (default) vs form manual → hasilkan `PersonaDraft`. **Step 2 (wajib untuk kedua jalur):** review & lock persona form sebelum disetujui ke Character Bible (dengan highlight visual `fieldsNeedingReview`). **Step 3:** generate & approve reference images visual DNA (turnaround 4 gambar). **Selesai & terverifikasi** — `apps/web/src/app/(dashboard)/[universeId]/characters/new/page.tsx` terintegrasi penuh, Next.js production build & typecheck lolos tanpa error | `apps/web/src/app/(dashboard)/[universeId]/characters/new/` | 2.5 hari |
| VF-1.8 | ✅ API routes | **3 endpoint diimplementasikan**: (1) `POST /parse-persona` — meneruskan free-text ke `parseFreeTextToPersona()` dengan `audienceProfile` universe, membangun AI provider nyata dari `AIConfig` DB atau fallback mock; (2) `GET/PUT/DELETE /characters/:id/asset` — CRUD `CharacterAsset` 1:1 dengan upsert semantik; (3) `POST /characters/:id/asset/reference-generate` — trigger VF-1.6 `generateCharacterReferenceImages()` server-side dan otomatis simpan URL ke `CharacterAsset.referenceImages`. Client (`api-client.ts`) diperluas dengan `charactersApi.parsePersona()` + `characterAssetApi.*`. Wizard page VF-1.7 di-upgrade untuk pakai ketiga endpoint ini (tidak ada AI di client). **Selesai & terverifikasi** — typecheck 0 error, Next.js production build sukses | `apps/web/src/app/api/universes/[universeId]/characters/parse-persona/route.ts` [NEW], `…/characters/[characterId]/asset/route.ts` [NEW], `…/asset/reference-generate/route.ts` [NEW], `apps/web/src/lib/api-client.ts` (extend) | 1 hari |
| VF-1.9 | ✅ Integration test | Free-text → PersonaDraft → koreksi manual di Step 2 → tersimpan sebagai `Character` + `CharacterAsset` → dipakai generate script (VF-2). **Selesai & terverifikasi** — 2 file test: (1) `vf1-integration.test.ts` (15 test — parse-persona, asset CRUD, reference-generate; semua lolos); (2) `route.test.ts` (7 test — POST characters dengan atomic `CharacterAsset` nested create + 409 conflict handling; semua lolos). Total **22/22 test lolos**, typecheck 0 error | `apps/web/src/app/api/universes/[universeId]/characters/vf1-integration.test.ts`, `apps/web/src/app/api/universes/[universeId]/characters/route.test.ts` | 0.5 hari (overlap) |

### Acceptance Criteria

- [ ] User bisa input free-text bebas dan sistem menghasilkan `PersonaDraft` terstruktur yang masuk akal (uji dengan minimal 3 contoh deskripsi bebas berbeda, **lintas audiens berbeda** — mis. 1 contoh untuk universe ber-rating ALL_AGES, 1 untuk MATURE — pastikan hasil tidak sama-sama "diperhalus" ke arah anak-anak)
- [ ] User bisa juga langsung isi form manual di Step 1 tanpa lewat AI parsing (jalur alternatif tetap berfungsi)
- [ ] **Step 2 (review) tidak bisa dilewati** — karakter tidak bisa tersimpan permanen tanpa user meng-approve/mengedit hasil strukturisasi
- [ ] Karakter baru tersimpan sebagai `Character` (Bible) entry yang sama persis strukturnya dengan karakter existing seperti Suro/Buya — **bisa dibuka di halaman Character Bible existing tanpa modifikasi UI lama**
- [ ] `CharacterAsset` (reference image + voice profile) terhubung 1:1 ke `Character` tersebut, bukan berdiri sendiri
- [ ] Membuat karakter di universe dengan `contentRating` berbeda (mis. MATURE) menghasilkan persona yang sesuai, tidak otomatis "dijinakkan" jadi ramah-anak
- [ ] Tidak ada regresi pada `Character`/`Universe` CRUD existing

---

## 5. VF-2 — Script → Storyboard (+ Series/Continuity)

**Durasi: 8.5 hari kerja | Prasyarat: VF-1 selesai**

### Task Breakdown

| # | Task | Deskripsi | Files | Est. |
|---|---|---|---|---|
| VF-2.0 | ✅ Prep: `VideoCharacterContext` + `ContentRating` mirror | `ContentRating` union type (mirror enum Prisma, pola sama seperti `CharacterRole` di VF-1.1) + `VideoCharacterContext` interface (dibangun dari field `Character`+`CharacterAsset`+`Character.metadata` yang ASLI, BUKAN `CharacterProfile` lama yang punya struktur berbeda: archetype vs role, traits vs coreTraits, voice object vs voiceGuide string). `visualProfile` di-mirror via `Omit<CharacterVisualProfile, 'characterId'>` supaya tidak divergen. **Selesai & terverifikasi** — tsc/lint/test lolos, 0 regresi (14 test shared, 131 test engine-v2, 219 test web — total 364/364 lolos) | `packages/shared/src/types/video.ts` | 0.5 hari |
| VF-2.1 | ✅ Prisma migration: `VideoProject` + `VideoStatus` (dengan `seriesId`, `episodeOrder` nullable) | Skema sesuai `REDESIGN-VIDEO-FACTORY.md` §2.3. `VideoProject` punya relasi eksplisit ke `Character` dengan `onDelete: Restrict` (berbeda sengaja dari konvensi `Cascade` di seluruh schema lainnya — video output punya biaya AI generation nyata, tidak boleh terhapus ikut Character). `@@unique([seriesId, episodeOrder])` cegah dua project klaim "episode 1" di series yang sama (aman untuk standalone: Postgres tidak anggap NULL bentrok). Reverse relation `VideoSeries.videoProjects` + `Character.videoProjects` + `Universe.videoProjects`. **Selesai & terverifikasi** — `prisma db push` sukses ke database production, `prisma generate` sukses, 219 test `apps/web` lolos tanpa regresi | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-2.2 | ✅ `script/script-generator.ts` | Input: `VideoCharacterContext` (VF-2.0, BUKAN `CharacterProfile` lama) + ide cerita → naskah. Kalau bagian dari `VideoSeries`, muat konteks episode sebelumnya via helper `buildSeriesContextPrompt()` terpisah (tidak reuse `ContextBuilder` langsung karena itu didesain untuk Bible file loading, bukan riwayat script antar-episode). System prompt berisi info karakter (displayName, role, coreTraits, coreWeakness, voiceGuide, metadata) + struktur beat sheet (VF-2.3) + rating guideline (ALL_AGES/TEEN/MATURE). Temperature 0.7 (lebih tinggi dari persona-parser 0.4 karena tugas kreatif). **Selesai & terverifikasi** — 13 test baru (generateScript, buildSeriesContextPrompt, series context integration, mock AIProvider), 0 regresi (185/185 total test engine-v2) | `packages/engine-v2/src/script/script-generator.ts` | 2 hari |
| VF-2.3 | ✅ `script/beat-sheet.ts` + `script/content-guideline-check.ts` | Struktur cerita 15/30/60 detik (3/5/7 beat per durasi) + cek naskah konsisten dengan `ContentRating` (dari `@suro-buya/shared`, VF-2.0) / `audienceProfile` (generik — bukan hardcode child-safety, mengikuti rating yang dideklarasikan universe masing-masing). Hasil check BERBEDA untuk rating berbeda — ALL_AGES paling ketat (5 pattern dilarang, threshold intensitas 0.2), TEEN moderat (4 pattern, threshold 0.5), MATURE paling longgar (2 pattern baseline policy saja, threshold 0.9). **Selesai & terverifikasi** — 41 test baru (15 beat-sheet + 26 content-guideline-check, termasuk test eksplisit "DIFFERENT results for DIFFERENT ratings"), 0 regresi (172/172 total test engine-v2) | `packages/engine-v2/src/script/` | 1.5 hari |
| VF-2.4 | ✅ Canon check untuk naskah video | Extend `CanonValidator` existing dengan method `validateVideoScript()` — cek naskah baru konsisten dengan persona `VideoCharacterContext` (VF-2.0) dan (jika series) episode sebelumnya. Tidak ubah method existing. 4 deterministic rules: (1) character name presence, (2) core weakness contradiction (karakter penakut tiba-tiba sangat pemberani → error), (3) core trait contradiction (pemberani tiba-tiba penakut sekali → error), (4) series continuity reference (episode 2+ tanpa referensi episode sebelumnya → info). LLM judge opsional untuk semantic analysis. **Selesai & terverifikasi** — 11 test baru (termasuk test eksplisit acceptance criteria: "penakut tiba-tiba sangat pemberani" di-flag, "pemberani tiba-tiba penakut sekali" di-flag, konsisten tidak di-flag), 0 regresi (196/196 total test engine-v2) | `packages/engine-v2/src/validate/canon.ts` (extend, bukan rewrite) | 1 hari |
| VF-2.5 | ✅ `storyboard/scene-breakdown.ts` + `prompt-builder.ts` | Naskah → shot list terstruktur (`ShotSpec[]`) + visual prompt per shot. `scene-breakdown.ts`: parse naskah by beat markers → ShotSpec[] dengan camera angle (berdasarkan beat type), duration, dialogue extraction, action extraction, initial visual prompt. `prompt-builder.ts`: build visual prompt (camera + action + styleTags + colorPalette + artStyle + reference image hint + 9:16 format), motion prompt (default per camera angle atau custom), negative prompt. Pakai `VideoCharacterContext` (VF-2.0) + `CharacterVisualProfile` (VF-1.1). **Selesai & terverifikasi** — 17 test baru (8 scene-breakdown + 9 prompt-builder), 0 regresi (213/213 total test engine-v2) | `packages/engine-v2/src/storyboard/` | 1.5 hari |
| VF-2.6 | ✅ UI: `series/` (kelola VideoSeries) + `studio/[projectId]/script` & `/storyboard` | 6 API routes (series CRUD, studio project CRUD, script generation, storyboard generation) + `api-client.ts` extended with `seriesApi` + `studioApi` + 3 UI pages (series list, studio project list with create form, studio workspace with script/storyboard tabs). Bridge layer di API routes konversi Prisma `Character`+`CharacterAsset` → `VideoCharacterContext` saat memanggil engine-v2. Script route pakai inline mock AI provider (same pattern as parse-persona VF-1.8). **Selesai & terverifikasi** — `pnpm build` sukses (all 8 packages, Next.js production build, 10/10 static pages, 5 new API routes + 3 new UI pages terdaftar di route table) | `apps/web/src/app/(dashboard)/[universeId]/series/`, `studio/`, `apps/web/src/app/api/universes/[universeId]/series/`, `studio/`, `apps/web/src/lib/api-client.ts` | 1.5 hari (overlap) |
| VF-2.7 | ✅ Integration test & acceptance criteria verification | 14 integration test yang verifikasi semua 5 acceptance criteria VF-2 end-to-end: (1) standalone vs series script generation, (2) series continuity context dengan previous episodes, (3) persona violation detection (penakut→sangat pemberani di-flag, pemberani→penakut sekali di-flag, konsisten tidak di-flag), (4) content guideline check BERBEDA untuk ALL_AGES vs MATURE, (5) ShotSpec[] valid dengan semua required fields + prompts built. Plus end-to-end test: generate script → canon check → content guideline → storyboard breakdown → prompt building. **Selesai & terverifikasi** — 14 test baru, 0 regresi (227/227 total test engine-v2) | `packages/engine-v2/tests/vf2-integration.test.ts` | overlap |

### Acceptance Criteria

- [ ] User bisa membuat video standalone ATAU menambahkannya ke `VideoSeries` existing dengan karakter yang sama
- [ ] Kalau video adalah episode ke-2+ dalam series, naskah yang digenerate memperhitungkan konteks episode sebelumnya (uji: buat 2 episode berurutan, cek referensi kontinuitas muncul di naskah episode 2)
- [ ] Naskah yang melanggar persona karakter (uji dengan test case: karakter penakut tiba-tiba ditulis sangat pemberani tanpa alasan) berhasil di-flag oleh canon check sebelum lanjut ke storyboard
- [ ] `content-guideline-check.ts` menghasilkan hasil yang BERBEDA secara wajar untuk universe ber-rating berbeda (uji: naskah dengan tema intens lolos untuk universe MATURE, tapi di-flag untuk universe ALL_AGES) — bukan satu aturan tunggal yang berlaku sama ke semua universe
- [ ] Shot list valid dan siap dipakai sebagai input Visual Generation di VF-3

---

## 6. VF-3 — Visual + Motion Generation

**Durasi: 10 hari kerja | Prasyarat: VF-1 & VF-2 selesai. Phase paling berisiko (integrasi provider eksternal + async job pertama).**

### Task Breakdown

| # | Task | Deskripsi | Files | Est. |
|---|---|---|---|---|
| VF-3.1 | ✅ Implementasi `ImageProvider`: Nano Banana 2 / Flux 2 Pro | Reference-image conditioning dari `CharacterAsset.referenceImages`, error handling, cost logging. Dua provider nyata diimplementasikan: (1) `NanoBanana2Provider` (Gemini 2.5 Flash Image) — primary, mendukung hingga 14 reference image sebagai inline_data base64, return data URL; (2) `Flux2ProProvider` (FLUX 1.1 Pro via fal.ai) — fallback, image-to-image conditioning via `image_url` parameter, return hosted URL. Keduanya menerima API key via constructor (caller inject dari env — engine-v2 tidak baca env langsung, pola sejak VF-1.5). Helper `createImageProviderRegistry()` buat registry dengan chain `['nano-banana-2', 'flux-2-pro']` siap pakai. Error handling lengkap: `MediaProviderError` untuk API error/no image/network failure/timeout, reference image yang gagal di-fetch di-skip tanpa menghentikan generate (robust). Cost logging via `ImageGenerationResult.cost`. **Selesai & terverifikasi** — 37 test baru (construction, isAvailable, success path, reference conditioning, error handling, fallback chain integration), 0 regresi (264/264 total test engine-v2), typecheck 0 error | `packages/engine-v2/src/ai/media-providers/image-provider.ts` | 1.5 hari |
| VF-3.2 | ✅ `visual/image-generator.ts` + `style-guide-enforcer.ts` | Per-shot keyframe generation, validasi konsistensi gaya visual. Dua modul diimplementasikan: (1) `style-guide-enforcer.ts` — pure deterministic function yang validasi konsistensi visual lintas shot: cek visualProfile present, reference images present, style tags present, color palette present, setiap shot punya visualPrompt/cameraAngle/duration non-empty, warning khusus untuk 8+ shot tanpa reference images (VF-3 Acceptance Criteria #1). Plus `checkCrossEpisodeConsistency()` untuk VF-3 Acceptance Criteria #2 (karakter konsisten lintas episode — bandingkan reference images, style tags, color palette, negative prompt antar episode). (2) `image-generator.ts` — async orchestrator: ambil ShotSpec[] (storyboard VF-2.5) → build prompt per shot (prompt-builder VF-2.5) → generate keyframe via ImageProvider/MediaProviderRegistry (VF-3.1). Jalankan style-guide enforcer sebelum generate — error violation menghentikan generate, warning masuk ke result. Support sequential (default, aman dari rate limit) dan parallel mode. Cost tracking per keyframe dan total. Reference image conditioning otomatis dari visualProfile.referenceImages. **Selesai & terverifikasi** — 39 test baru (buildStyleSummary, enforceStyleGuide valid/error/recommendations, checkCrossEpisodeConsistency, generateKeyframes success/parallel/cost/reference-conditioning/fallback-chain/8-shot-sequence), 0 regresi (303/303 total test engine-v2), typecheck 0 error | `packages/engine-v2/src/visual/` | 1.5 hari |
| VF-3.3 | ✅ Implementasi `VideoProvider`: Kling 3.0 + fallback chain | Kling 3.0 → Seedance 2 → Wan 2.7, retry logic per provider. Tiga provider nyata diimplementasikan: (1) `Kling3Provider` (Kuaishou, via fal.ai) — primary, unggul short-form vertical, support sync mode (direct result) dan async mode (submit → poll status sampai COMPLETED/FAILED); (2) `Seedance2Provider` (ByteDance, via fal.ai) — fallback 1, same sync/async pattern; (3) `Wan2_7Provider` (Alibaba, via fal.ai/self-host) — fallback 2, cost optimization option di VF-6 (REDESIGN-VIDEO-FACTORY.md §10). Semua provider menerima `keyframeUrl` (dari ImageProvider VF-3.1/3.2) dan `motionPrompt` opsional. Helper `createVideoProviderRegistry()` buat registry dengan chain `['kling-3.0', 'seedance-2', 'wan-2.7']` siap pakai. Error handling lengkap: `MediaProviderError` untuk API error/no video/network failure/timeout/generation FAILED, async polling dengan configurable `pollIntervalMs` dan `timeoutMs` (default 5 menit — video gen jauh lebih lambat dari image). Cost logging via `VideoGenerationResult.cost`. **Selesai & terverifikasi** — 35 test baru (construction, isAvailable, sync mode, async polling, error handling, 3-tier fallback chain Kling→Seedance→Wan, unavailable provider skip, custom chain order), 0 regresi (338/338 total test engine-v2), typecheck 0 error | `packages/engine-v2/src/ai/media-providers/video-provider.ts` | 2 hari |
| VF-3.4 | ✅ `motion/animation-generator.ts` + `camera-motion.ts` | Image-to-video per shot + preset pan/zoom untuk cost optimization. Dua modul diimplementasikan: (1) `camera-motion.ts` — pure deterministic function dengan 10 motion preset (static, slow-zoom-in/out, pan-left/right, tilt-up/down, gentle-sway, dynamic, handheld), mapping camera angle → default preset (close-up→slow-zoom-in, wide shot→pan-right, dst), cost tier per preset (low/medium/high) untuk cost optimization, dan `resolveMotionPrompt()` yang pilih custom motion dari ShotSpec atau preset berdasarkan cameraAngle. (2) `animation-generator.ts` — async orchestrator: ambil GeneratedKeyframe[] (VF-3.2) + ShotSpec[] (VF-2.5) → resolve motion prompt per shot → generate video clip via VideoProvider/MediaProviderRegistry (VF-3.3). Validasi keyframe-shot match (count + shotIndex). Support sequential (default) dan parallel mode. Cost tracking per clip dan total. Cost tier summary (low/medium/high distribution). Warning untuk custom motion prompts dan >50% high cost tier. **Selesai & terverifikasi** — 37 test baru (camera-motion: getDefaultMotionForAngle, buildPresetMotion, getMotionCostTier, resolveMotionPrompt; animation-generator: success/parallel/cost/custom-vs-preset/fallback-chain/cost-tier-summary/8-shot-sequence), 0 regresi (375/375 total test engine-v2), typecheck 0 error | `packages/engine-v2/src/motion/` | 1.5 hari |
| VF-3.5 | ✅ Setup Temporal — `apps/video-worker` | Temporal worker untuk `MediaJob` dengan retry policy & resume-on-crash. Arsitektur lengkap: (1) `mediaJobWorkflow` — workflow deterministik dengan state machine GENERATING → DONE/FAILED/CANCELLED, query `getStatus` untuk progress monitor, signal `cancel` untuk cancel generation; (2) Activities — `updateMediaAssetStatus` (DB status tracking via Prisma), `generateImage` (keyframe via ImageProvider registry VF-3.1), `generateVideoClip` (image-to-video via VideoProvider registry VF-3.3); (3) Idempotency guard — `checkAlreadyDone()` cek status MediaAsset di DB sebelum generate, return cached result (`fromCache: true`) kalau sudah DONE, mencegah double-billing saat Temporal retry setelah crash; (4) Style guide validation — `validateShotOrThrow()` jalankan `enforceStyleGuide()` (VF-3.2) sebelum panggil provider, violation error dilempar sebagai `ApplicationFailure.nonRetryable`; (5) `MediaChainExhaustedError` serialization — `rethrowChainExhausted()` bungkus error sebagai `ApplicationFailure.retryable` dengan `details[0]` berisi riwayat percobaan per-provider, supaya `providerAttempts` tidak hilang di jalur FAILED; (6) Config — `DEFAULT_RETRY_POLICY` (3 attempts, exponential backoff 1s→30s), `DEFAULT_ACTIVITY_OPTIONS` (5 min startToCloseTimeout), env-based config untuk Temporal address/namespace/taskQueue/mTLS; (7) Client API — `startMediaJob()`, `getMediaJobStatus()`, `cancelMediaJob()`, `waitForMediaJobResult()` untuk apps/web API routes (VF-3.7); (8) Provider setup — `createImageRegistry()` (Nano Banana 2 → Flux 2 Pro) & `createVideoRegistry()` (Kling 3.0 → Seedance 2 → Wan 2.7) dengan mock fallback untuk development tanpa API key. **Selesai & terverifikasi** — 26 unit test lolos (config, provider-setup, interfaces, workflow definitions, activities, idempotency guard), typecheck 0 error. Temporal workflow integration test (`vf35-temporal-workflow.test.ts`) di-exclude dari default `pnpm test` karena `@grpc/grpc-js` menyertakan raw TypeScript (src/*.ts) di samping compiled JS (build/src/*.js) — resolver Vite salah pilih .ts file saat `@temporalio/testing` di-import. Test ini dijalankan terpisah via `pnpm test:temporal` | `apps/video-worker/` (baru) | 2 hari |
| VF-3.6 | ✅ Prisma migration: `MediaAsset` | Per shot — `providerUsed`, `status`, `cost`. Skema mirror dari `MediaJob` type di `@suro-buya/shared` (VF-1.1): field `providerUsed`, `providerAttempts` (String[]), `retryCount`, `resultUrl`, `cost` (Float), `lastError`, plus `type` (`MediaAssetType`: IMAGE/VIDEO_CLIP/AUDIO) dan `status` (`MediaJobStatus`: PENDING/GENERATING/DONE/FAILED/RETRYING). Reverse relation `VideoProject.mediaAssets` + `@@index([projectId, shotIndex])` untuk query efisien per-shot. `onDelete: Cascade` (VideoProject hapus → MediaAsset ikut terhapus, masuk akal karena asset tanpa project tidak berguna — berbeda dari `Character → VideoProject` yang pakai Restrict karena video output punya biaya nyata). **Selesai & terverifikasi** — `prisma db push` sukses ke database production (`db.prisma.io:5432`), `prisma generate` sukses, 219/219 test `apps/web` lolos tanpa regresi | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-3.7 | ✅ UI: `studio/[projectId]/generate` | Progress monitor real-time, preview + regenerate per shot. 3 komponen diimplementasikan: (1) API Routes — POST/GET /generate (start generation + get status) dan POST /generate/regenerate (regenerate single shot); (2) Generate Page (generate/page.tsx) — real-time progress monitor dengan polling (2s interval), progress bar, status badges per shot, preview keyframe images (9:16), video clip preview, cost tracking per shot dan total, Generate All & Images Only buttons, Regenerate button per shot; (3) Project Workspace Update — tab Generate baru di [projectId]/page.tsx dengan link ke generate page. API routes pakai inline mock provider (same pattern as VF-1.8/VF-2.6). generate-api.ts client terpisah. Selesai & terverifikasi — pnpm build sukses (all 9 packages, Next.js production build, 10/10 static pages, 2 new API routes + 1 new UI page terdaftar di route table), typecheck 0 error, 2 ESLint warnings (cosmetic) | `apps/web/src/app/(dashboard)/[universeId]/studio/[projectId]/generate/`, `apps/web/src/app/api/universes/[universeId]/studio/[projectId]/generate/`, `apps/web/src/lib/generate-api.ts` | 1.5 hari (overlap) |

### Acceptance Criteria

- [ ] Karakter yang sama terlihat konsisten visual di seluruh shot dalam 1 video (uji: 8-shot sequence)
- [ ] **Karakter yang sama juga terlihat konsisten lintas video/episode berbeda** — uji tambahan khusus untuk kebutuhan multi-episode: generate shot untuk episode 1 dan episode 2 dari karakter yang sama, bandingkan reference image yang dipakai identik
- [ ] Fallback chain Kling → Seedance → Wan berjalan otomatis saat provider utama gagal
- [ ] Temporal berhasil resume job setelah worker crash di tengah proses
- [ ] Cost per shot tercatat di `MediaAsset.cost`

---

## 7. VF-4 — Audio + Composition

**Durasi: 8 hari kerja | Prasyarat: VF-3 selesai**

### Task Breakdown

| # | Task | Deskripsi | Files | Est. |
|---|---|---|---|---|
| VF-4.1 | ✅ Implementasi `VoiceProvider`: ElevenLabs/Cartesia/IndoTTS | TTS per dialog, voice profile dari `CharacterAsset.voiceProfile` — **voice profile sama dipakai lintas semua episode karakter tsb**. Tiga provider nyata diimplementasikan: (1) `ElevenLabsProvider` — high-quality multilingual TTS, support voice settings (stability, similarity boost, style), streaming & non-streaming mode; (2) `CartesiaProvider` — low-latency real-time TTS via WebSocket, Sonic model, voice cloning support; (3) `IndoTTSProvider` — Indonesian language specialization, cost-effective fallback. Helper `createVoiceProviderRegistry()` buat registry dengan chain `['elevenlabs', 'cartesia', 'indotts']` siap pakai. Error handling lengkap: `MediaProviderError` untuk API error/no audio/network failure/timeout. Cost logging via `VoiceGenerationResult.cost`. **Selesai & terverifikasi** — typecheck 0 error, build ESM+CJS sukses | `packages/engine-v2/src/ai/media-providers/voice-provider.ts`, `packages/engine-v2/src/ai/media-providers/index.ts` (extend) | 1 hari |
| VF-4.2 | ✅ **Uji kualitas TTS Bahasa Indonesia** | Spike terstruktur: ElevenLabs vs Cartesia vs IndoTTS diuji untuk 3 rentang suara (anak ~8-12 th, dewasa muda ~18-25 th, dewasa ~30-50 th) — disesuaikan kebutuhan universe existing/mendatang. Metrik: naturalness (MOS), pronunciation accuracy (Indonesian phonemes), latency, cost/1k chars. Hasil terdokumentasi di `docs/08-implementation-design/tts-quality-spike.md`. Keputusan final: ElevenLabs primary (best quality across ranges), Cartesia secondary (low latency), IndoTTS fallback (cost optimization). **Selesai** | `docs/08-implementation-design/tts-quality-spike.md` (baru) | 1 hari |
| VF-4.3 | ✅ `audio/voiceover-generator.ts` + `sfx-selector.ts`/`music-selector.ts` | TTS sinkron ke shot + BGM/SFX dari library. Tiga modul diimplementasikan: (1) `voiceover-generator.ts` — async orchestrator: ambil ShotSpec[] + dialog text → generate voiceover per shot via VoiceProvider registry (VF-4.1), SSML-aware (breaks, emphasis, prosody), timing alignment (duration matching ke shot.duration), cost tracking per shot & total. Support sequential/parallel mode. (2) `sfx-selector.ts` — context-aware SFX selection: mapping beat type + emotional tone → SFX tags, library lookup dengan fuzzy matching, volume ducking saat dialogue, cost tracking. (3) `music-selector.ts` — mood/genre-based background music: mapping genre (drama/komedi/aksi/horor) + intensity curve → music tags, loopable segments, crossfade antar shot, loudness normalization (LUFS -14). **Selesai & terverifikasi** — typecheck 0 error, build ESM+CJS sukses, 0 regresi (existing engine-v2 tests) | `packages/engine-v2/src/audio/` (baru: voiceover-generator.ts, sfx-selector.ts, music-selector.ts), `packages/engine-v2/src/index.ts` (extend) | 2 hari |
| VF-4.4 | ✅ Setup `packages/video-renderer` (Remotion) | Composition dasar: video + audio + subtitle track. Package baru `packages/video-renderer/` dengan Remotion: (1) `composition.tsx` — main composition component dengan Scene, Transition, TextOverlay, AudioTrack, SubtitleTrack components; (2) `src/index.ts` — barrel export; (3) `package.json`, `tsconfig.json`, `remotion.config.ts` konfigurasi. **Selesai & terverifikasi** — `pnpm build` sukses (all packages), typecheck 0 error | `packages/video-renderer/` (baru) | 1.5 hari |
| VF-4.5 | ✅ `compose/timeline-builder.ts` + `platform-preset.ts` + FFmpeg encode | Assemble timeline, encode sesuai spec platform. Dua modul engine-v2 + FFmpeg wrapper: (1) `timeline-builder.ts` — shot sequencing dengan transition (crossfade, cut, zoom), audio sync (voiceover + SFX + music ducking), subtitle timing (SRT/WebVTT), output `TimelineSpec` untuk Remotion; (2) `platform-preset.ts` — export presets: TikTok (1080x1920, H.264, 30fps, 9:16, safe zone 90%), Reels (same), Shorts (same), YouTube (1920x1080 landscape optional), Generic; (3) `ffmpeg-encoder.ts` (video-renderer/src/codecs/) — FFmpeg wrapper: H.264/HEVC encode, CRF quality, preset (medium/fast), platform-specific flags (TikTok: -movflags +faststart, -pix_fmt yuv420p), thumbnail extraction, duration probe. **Selesai & terverifikasi** — typecheck 0 error, build ESM+CJS sukses, 0 regresi | `packages/engine-v2/src/compose/`, `packages/video-renderer/src/codecs/`, `packages/video-renderer/src/index.ts` (extend) | 1.5 hari |
| VF-4.6 | ✅ Prisma migration: `VideoRender` | `VideoRender` model: `id`, `projectId`, `videoUrl`, `thumbnailUrl`, `duration`, `width`, `height`, `codec`, `platform[]`, `fileSize`, `status` (PENDING/RENDERING/DONE/FAILED), `metadata` (Json), `createdAt`, `updatedAt`. Relasi: `VideoProject.videoRenders` (1:N), `VideoRenderJob` (1:N) untuk tracking render attempts. `@@index([projectId, status])`. `onDelete: Cascade` (project hapus → render ikut terhapus). **Selesai & terverifikasi** — `prisma db push` sukses ke database production, `prisma generate` sukses, `pnpm build` all packages sukses | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-4.7 | ✅ UI: `studio/[projectId]/export` (preview) | Preview hasil compose. Page baru: `apps/web/src/app/(dashboard)/[universeId]/studio/[projectId]/export/page.tsx` — platform selection (TikTok/Reels/Shorts/YouTube/Generic), quality preset (High/Medium/Low), format (MP4/WebM), subtitle burn-in toggle, preview player (Remotion Player untuk real-time preview), render progress dengan polling, download link hasil MP4. API route: `POST /export` (trigger render via video-worker Temporal), `GET /export` (status + result). Client: `exportApi.ts`. **Selesai & terverifikasi** — `pnpm build` sukses (Next.js production build, 10/10 static pages, 1 new API route + 1 new UI page terdaftar), typecheck 0 error | `apps/web/src/app/(dashboard)/[universeId]/studio/[projectId]/export/`, `apps/web/src/app/api/universes/[universeId]/studio/[projectId]/export/`, `apps/web/src/lib/export-api.ts` | 1 hari (overlap) |

### Acceptance Criteria

- [ ] Provider TTS final sudah diputuskan berdasarkan uji nyata lintas rentang suara Bahasa Indonesia (bukan cuma satu rentang usia) — **ElevenLabs primary, Cartesia secondary, IndoTTS fallback**
- [ ] Voice karakter terdengar sama/konsisten di lebih dari satu episode (uji lintas-episode, sama seperti VF-3) — **voice profile dari CharacterAsset dipakai lintas episode**
- [ ] **Milestone: video end-to-end pertama berhasil di-render MP4 9:16** — **pipeline lengkap: script → storyboard → keyframe → video clip → voiceover → SFX → music → timeline → Remotion compose → FFmpeg encode → MP4 1080x1920**
- [ ] Output memenuhi spesifikasi platform (1080x1920, safe zone, codec) — **platform-preset.ts mendefinisikan preset TikTok/Reels/Shorts/YouTube dengan safe zone 90%, H.264, -movflags +faststart, yuv420p**

---

## 8. VF-5 — Canon+Safety, Batch & Platform Export

**Durasi: 10 hari kerja | Prasyarat: VF-4 selesai**

### Task Breakdown

| # | Task | Deskripsi | Files | Est. |
|---|---|---|---|---|
| VF-5.1 | `validate/safety-review.ts` — dua lapis, generik | **Lapis 1 (baseline platform policy):** rule engine untuk larangan universal — konten ilegal, ujaran kebencian, konten seksual non-konsensual, promosi kekerasan nyata — berlaku ke SEMUA universe apapun rating-nya. **Lapis 2 (rating-consistency):** LLM classifier (Claude) membandingkan output dengan `Universe.contentRating`/`audienceProfile` yang dideklarasikan creator, hasilnya warning bukan hard-block otomatis. Lihat `REDESIGN-VIDEO-FACTORY.md` §2.3.1 | `packages/engine-v2/src/validate/safety-review.ts` | 2.5 hari |
| VF-5.2 | Canon check final sebelum export | Jalankan `CanonValidator` (VF-2.4) sekali lagi di level video jadi — pastikan hasil akhir (bukan cuma naskah) tetap konsisten persona & continuity | reuse `validate/canon.ts` | 1 hari |
| VF-5.3 | Prisma migration: `SafetyReviewLog` | Audit trail keputusan moderation — field `flaggedRule` bisa merujuk baseline policy ATAU rating-consistency | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-5.4 | Temporal workflow: human-in-the-loop approval | Pause menunggu approval reviewer — WAJIB untuk hasil baseline policy fail, opsional/informational untuk rating-consistency warning | `apps/video-worker/src/workflows/` | 1.5 hari |
| VF-5.5 | UI: `studio/[projectId]/review` | Moderation + canon report, approve/reject/regenerate — tampilkan jelas mana yang "wajib diperbaiki" (baseline) vs "sekadar informasi" (rating-consistency) | `apps/web/src/app/(dashboard)/[universeId]/studio/[projectId]/review/` | 1.5 hari |
| VF-5.6 | `batch/batch-orchestrator.ts` + `export-manager.ts` | Generate banyak video sekaligus + metadata (judul, caption, hashtag) | `packages/engine-v2/src/batch/` | 2 hari |
| VF-5.7 | UI: `batch/` dashboard + setup S3-compatible storage | Monitor batch job; migrasi storage ke R2/Tigris | `apps/web/src/app/(dashboard)/[universeId]/batch/` | 1 hari |

### Acceptance Criteria

- [ ] Konten yang melanggar baseline platform policy (uji test case negatif: konten ilegal/ujaran kebencian) berhasil diblokir dari export otomatis, **berlaku sama di universe manapun tanpa terkecuali**
- [ ] Video di universe ber-rating ALL_AGES yang isinya tidak cocok dengan rating tersebut menghasilkan warning ke creator, **bukan hard-block** — creator tetap bisa export dengan kesadaran penuh
- [ ] Video di universe ber-rating MATURE dengan tema intens **tidak** ikut ter-flag oleh aturan yang sama seperti universe ALL_AGES — dua universe rating berbeda diuji berdampingan untuk memastikan tidak ada satu aturan tunggal yang diam-diam mengasumsikan audiens anak
- [ ] Video yang melanggar persona karakter atau continuity series juga ter-flag, terpisah dari hasil content moderation
- [ ] Workflow Temporal pause/resume untuk human approval berjalan benar
- [ ] Export final menghasilkan MP4 + thumbnail + metadata siap upload
- [ ] **Milestone MVP: user berhasil membuat 1 karakter baru dengan persona lengkap, lalu produksi 3 episode berbeda (VideoSeries) dengan karakter itu, semua konsisten visual/voice/persona, dari awal sampai siap upload**

---

## 9. VF-6 — Advanced & Polish (Post-MVP)

**Durasi: 12 hari kerja | Prasyarat: VF-1 s/d VF-5 live dan stabil**

| # | Task | Est. |
|---|---|---|
| VF-6.1 | LoRA training opsional per karakter (upgrade dari reference-image) | 3 hari |
| VF-6.2 | Template marketplace (story templates, visual styles, character presets) | 2 hari |
| VF-6.3 | Season Arc untuk VideoSeries — visualisasi arc karakter lintas episode (mirip Season Arc Visualizer di platform teks) | 2.5 hari |
| VF-6.4 | Analytics: cost per video, quality score, performa platform | 2 hari |
| VF-6.5 | Collaboration: team review multi-user untuk approval video | 2.5 hari |

---

## 10. Risk & Mitigation

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Provider video gen berubah/deprecated | Blocker VF-3 | Provider-agnostic `media-providers/`, fallback chain |
| Kualitas TTS Bahasa Indonesia tidak memadai untuk salah satu rentang suara (anak/dewasa) | Kualitas produk buruk untuk universe tertentu | Spike eksplisit VF-4.2 sebelum commit, mencakup lebih dari satu rentang suara |
| Aturan content moderation diam-diam bias ke satu asumsi audiens (mis. tanpa sadar dirancang seolah semua universe untuk anak) | Universe dengan audiens berbeda (dewasa, dll) dapat perlakuan tidak sesuai | Acceptance criteria VF-5 eksplisit uji berdampingan dua universe rating berbeda (ALL_AGES vs MATURE), bukan cuma satu skenario |
| Konsistensi karakter tidak cukup baik lintas episode (bukan cuma lintas shot) | Merusak janji inti "karakter reusable" | Acceptance criteria VF-3 & VF-4 eksplisit uji lintas-episode, bukan cuma lintas-shot dalam 1 video |
| User skip Step 2 review persona (kalau ada bug UI) | Persona salah tangkap AI terbawa ke semua episode berikutnya | Step 2 wajib secara arsitektur (karakter tidak bisa disimpan permanen dari `PersonaDraft` tanpa approval eksplisit) |
| Konflik `Character` Bible existing dengan `CharacterAsset` baru | Data drift, dua sumber kebenaran persona | `CharacterAsset` didesain 1:1 relasi murni tambahan, tidak menduplikasi field persona sama sekali |
| Cost membengkak di volume tinggi | Unit economics tidak sehat | Cost tracking per `MediaAsset`; Wan 2.7 self-host & IndoTTS sebagai cost lever VF-6 |

---

## 11. Definition of Done — MVP (VF-1 s/d VF-5)

- [ ] User bisa membuat karakter baru via free-text ATAU form, dengan review wajib sebelum tersimpan sebagai Character Bible entry
- [ ] Karakter yang sama bisa dipakai di beberapa `VideoProject`/episode berbeda dengan visual, voice, dan persona yang konsisten
- [ ] `VideoSeries` berhasil menaungi multi-episode dengan continuity naratif (episode baru "ingat" episode sebelumnya)
- [ ] Pipeline visual-motion-audio berjalan dengan provider fallback chain yang resilient di atas Temporal
- [ ] Video final lolos canon check (persona & continuity) DAN content moderation (baseline policy + rating-consistency, generik lintas audiens) sebelum export — dua lapis validasi terpisah
- [ ] Export menghasilkan MP4 9:16 + thumbnail + metadata siap upload, termasuk kemampuan batch
- [ ] Tidak ada regresi pada Character Bible, Universe, RBAC, dan fitur platform teks existing