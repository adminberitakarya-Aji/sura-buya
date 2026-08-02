# Implementation Plan — AI Video Factory (Sura & Buya)

> **Status:** Draft — menunggu konfirmasi untuk mulai VF-1
> **Created:** 2026-08-02
> **Version:** 2.1 (revisi: platform generik lintas audiens — Suro & Buya jadi salah satu contoh universe, bukan asumsi default; lihat `REDESIGN-VIDEO-FACTORY.md` Prinsip #4)
> **Dokumen terkait:** `REDESIGN-VIDEO-FACTORY.md` (audit, arsitektur, keputusan tools)
> **Penomoran phase:** Sengaja diberi prefix **VF-** (bukan "Phase 1..6" polos) supaya tidak bentrok dengan Phase 5-6 di `IMPLEMENTATION-PLAN.md` (platform teks) yang sedang berjalan.
> **Prinsip migrasi:** Extend, don't rewrite. `Character`, `CanonValidator`, `ContextBuilder`, RBAC, auth — tidak diubah, hanya diperluas.

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
| VF-2 | Script → Storyboard (+ Series/continuity) | 8 hari kerja | Minggu 2-3 |
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
| VF-1.5 | `character/character-builder.ts` | Terima `PersonaDraft` yang sudah di-approve user → simpan sebagai `Character` (Bible) entry permanen — **bukan bikin tabel baru**, reuse model `Character` existing | `packages/engine-v2/src/character/character-builder.ts` | 1 hari |
| VF-1.6 | `character/reference-generator.ts` | Generate 3-5 reference image dari persona final | `packages/engine-v2/src/character/reference-generator.ts` | 1 hari |
| VF-1.7 | Wizard "Create New Character" — 2 Step | **Step 1:** toggle free-text (default) vs form manual → hasilkan `PersonaDraft`. **Step 2 (wajib untuk kedua jalur):** review/edit form sebelum lock ke Character Bible. **Step 3:** generate & approve reference image | `apps/web/src/app/(dashboard)/[universeId]/characters/new/` | 2.5 hari |
| VF-1.8 | API routes | `PersonaDraft` parsing endpoint (meneruskan `universe.contentRating`/`audienceProfile` ke `parseFreeTextToPersona()`), `CharacterAsset` CRUD, reference-generate endpoint | `apps/web/src/app/api/universes/[universeId]/characters/[characterId]/asset/` | 1 hari |
| VF-1.9 | Integration test | Free-text → PersonaDraft → koreksi manual di Step 2 → tersimpan sebagai `Character` + `CharacterAsset` → dipakai generate script (VF-2) | test file terkait | 0.5 hari (overlap) |

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

**Durasi: 8 hari kerja | Prasyarat: VF-1 selesai**

### Task Breakdown

| # | Task | Deskripsi | Files | Est. |
|---|---|---|---|---|
| VF-2.1 | Prisma migration: `VideoSeries` + `VideoProject` (dengan `seriesId`, `episodeOrder` nullable) | Sesuai skema §2.3 | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-2.2 | `script/script-generator.ts` | Input: karakter (dari Bible) + ide cerita → naskah. Kalau bagian dari `VideoSeries`, muat konteks episode sebelumnya (reuse `ContextBuilder`) | `packages/engine-v2/src/script/script-generator.ts` | 2 hari |
| VF-2.3 | `script/beat-sheet.ts` + `script/content-guideline-check.ts` | Struktur cerita 15/30/60 detik + cek naskah konsisten dengan `Universe.contentRating`/`audienceProfile` (generik — bukan hardcode child-safety, mengikuti rating yang dideklarasikan universe masing-masing) | `packages/engine-v2/src/script/` | 1.5 hari |
| VF-2.4 | Canon check untuk naskah video | Reuse `CanonValidator` existing — cek naskah baru konsisten dengan persona `Character` dan (jika series) episode sebelumnya | `packages/engine-v2/src/validate/canon.ts` (extend, bukan rewrite) | 1 hari |
| VF-2.5 | `storyboard/scene-breakdown.ts` + `prompt-builder.ts` | Naskah → shot list terstruktur + visual prompt per shot | `packages/engine-v2/src/storyboard/` | 1.5 hari |
| VF-2.6 | UI: `series/` (kelola VideoSeries) + `studio/[projectId]/script` & `/storyboard` | Pilih standalone vs tambah-ke-series; storyboard editor drag-drop | `apps/web/src/app/(dashboard)/[universeId]/series/`, `studio/` | 1.5 hari (overlap) |

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
| VF-3.1 | Implementasi `ImageProvider`: Nano Banana 2 / Flux 2 Pro | Reference-image conditioning dari `CharacterAsset.referenceImages`, error handling, cost logging | `packages/engine-v2/src/ai/media-providers/image-provider.ts` | 1.5 hari |
| VF-3.2 | `visual/image-generator.ts` + `style-guide-enforcer.ts` | Per-shot keyframe generation, validasi konsistensi gaya visual | `packages/engine-v2/src/visual/` | 1.5 hari |
| VF-3.3 | Implementasi `VideoProvider`: Kling 3.0 + fallback chain | Kling 3.0 → Seedance 2 → Wan 2.7, retry logic per provider | `packages/engine-v2/src/ai/media-providers/video-provider.ts` | 2 hari |
| VF-3.4 | `motion/animation-generator.ts` + `camera-motion.ts` | Image-to-video per shot + preset pan/zoom untuk cost optimization | `packages/engine-v2/src/motion/` | 1.5 hari |
| VF-3.5 | Setup Temporal — `apps/video-worker` | Workflow untuk `MediaJob`, retry policy, resume-on-crash | `apps/video-worker/` (baru) | 2 hari |
| VF-3.6 | Prisma migration: `MediaAsset` | Per shot — `providerUsed`, `status`, `cost` | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-3.7 | UI: `studio/[projectId]/generate` | Progress monitor real-time, preview + regenerate per shot | `apps/web/src/app/(dashboard)/[universeId]/studio/[projectId]/generate/` | 1.5 hari (overlap) |

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
| VF-4.1 | Implementasi `VoiceProvider`: ElevenLabs/Cartesia | TTS per dialog, voice profile dari `CharacterAsset.voiceProfile` — **voice profile sama dipakai lintas semua episode karakter tsb** | `packages/engine-v2/src/ai/media-providers/voice-provider.ts` | 1 hari |
| VF-4.2 | **Uji kualitas TTS Bahasa Indonesia** | Spike: ElevenLabs vs Cartesia vs IndoTTS untuk beragam rentang suara (anak, dewasa muda, dewasa — disesuaikan kebutuhan universe existing/mendatang), keputusan final provider | (riset) | 1 hari |
| VF-4.3 | `audio/voiceover-generator.ts` + `sfx-selector.ts`/`music-selector.ts` | TTS sinkron ke shot + BGM/SFX dari library | `packages/engine-v2/src/audio/` | 2 hari |
| VF-4.4 | Setup `packages/video-renderer` (Remotion) | Composition dasar: video + audio + subtitle track | `packages/video-renderer/` (baru) | 1.5 hari |
| VF-4.5 | `compose/timeline-builder.ts` + `platform-preset.ts` + FFmpeg encode | Assemble timeline, encode sesuai spec platform | `packages/engine-v2/src/compose/`, `packages/video-renderer/src/codecs/` | 1.5 hari |
| VF-4.6 | Prisma migration: `VideoRender` | `videoUrl`, `thumbnailUrl`, `duration`, `platform[]` | `apps/web/prisma/schema.prisma` | 0.5 hari |
| VF-4.7 | UI: `studio/[projectId]/export` (preview) | Preview hasil compose | `apps/web/src/app/(dashboard)/[universeId]/studio/[projectId]/export/` | 1 hari (overlap) |

### Acceptance Criteria

- [ ] Provider TTS final sudah diputuskan berdasarkan uji nyata lintas rentang suara Bahasa Indonesia (bukan cuma satu rentang usia)
- [ ] Voice karakter terdengar sama/konsisten di lebih dari satu episode (uji lintas-episode, sama seperti VF-3)
- [ ] **Milestone: video end-to-end pertama berhasil di-render MP4 9:16**
- [ ] Output memenuhi spesifikasi platform (1080x1920, safe zone, codec)

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