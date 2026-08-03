# Redesign: Sura & Buya → AI Video Factory

> **Status:** Draft — arsitektur disepakati, menunggu konfirmasi mulai VF-1
> **Created:** 2026-08-02
> **Dokumen terkait:** `IMPLEMENTATION-PLAN.md` (roadmap platform teks — Phase 0-4 selesai, Phase 5-6 berjalan), `IMPLEMENTATION-PLAN-VIDEO-FACTORY.md` (task breakdown VF-1 s/d VF-6)

**Repo yang diaudit:** `github.com/adminberitakarya-Aji/sura-buya`
**Tujuan:** Memperluas AI Story/Bible Engine dengan kemampuan menghasilkan video pendek (TikTok/YouTube Shorts, 15-60 detik, vertikal 9:16) untuk **audiens umum, lintas segmen**. Platform ini generik — universe apapun bisa dibuat di atasnya, dengan audiens/rating masing-masing ditentukan sendiri oleh creator per-universe. **Suro & Buya (target keluarga/anak) hanyalah salah satu contoh universe di platform ini, bukan asumsi default untuk semua universe.** Karakter bisa dibuat baru dengan persona lengkap, dan satu karakter bisa dipakai lintas beberapa episode/cerita berbeda — video adalah output tambahan dari bible yang sudah dalam, bukan tool produksi video generik yang berdiri sendiri.

---

## 0. Prinsip Desain (Hasil Diskusi)

Sebelum masuk detail teknis, tiga prinsip ini mengunci arah desain di seluruh dokumen:

1. **Karakter bukan aset sekali-pakai.** Satu karakter bisa dipakai di banyak episode/cerita berbeda — artinya persona, visual, dan voice-nya harus konsisten dan tersimpan permanen, bukan dibuat ulang tiap kali generate video. Ini kenapa `CharacterAsset` untuk video **harus terhubung ke Character Bible existing**, bukan tabel terpisah dengan persona versi ringan sendiri (lihat bagian 2.3).
2. **Video Factory adalah perluasan filosofi lama (bible-driven), bukan produk baru.** Sistem lama optimasi untuk kedalaman canon; Video Factory menambahkan output video di atas kedalaman yang sama — bukan menggantinya dengan optimasi volume/kecepatan generik.
3. **Continuity lintas episode perlu struktur eksplisit.** Karena video bisa multi-episode dengan karakter sama, perlu konsep `VideoSeries` yang menaungi beberapa video — mirip `Season → Episode` di sistem lama, tapi untuk video pendek (lihat bagian 2.3 & 5).
4. **Tidak ada asumsi audiens/rating default di level engine.** Platform ini generik — audiens (anak-anak, remaja, dewasa, dll) ditentukan per-universe oleh creator, bukan di-hardcode di engine atau prompt AI. Suro & Buya kebetulan target keluarga/anak, tapi itu konfigurasi universe tersebut, bukan asumsi platform. Lihat `Content Rating` di bagian 2.3.

---

## 1. Analisis Singkat Repo Saat Ini

**Struktur:** pnpm monorepo — `apps/web` (Next.js 14 dashboard), `apps/cli`, `packages/engine-v2` (AI factory core), `packages/shared`, `packages/ui`, `packages/templates`, `packages/config`.

### Kekuatan
- `engine-v2` punya arsitektur "skills" yang matang untuk *teks*: `character/` (voice-consistency, trait-enforcer), `camera/` (shot-composer, storyboard-generator), `environment/` (continuity-guard, culture-validator), `writing/` (dialogue, action, pacing), `audit/` (canon-validator, quality-scorer).
- Provider AI sudah abstrak (`AIProvider` interface di `ai/providers.ts`) — mendukung OpenAI/Anthropic/Ollama secara pluggable.
- **`Character` model dan Character Bible sudah jadi sumber kebenaran persona** — ini yang membuat prinsip desain #1 di atas bisa dieksekusi tanpa membangun ulang dari nol.
- `CanonValidator` (rule engine + LLM judge) sudah ada dan reusable untuk cek konsistensi lintas episode video, bukan cuma teks.
- RBAC dan multi-tenant (`UniverseMember`) sudah ada.

### Kelemahan / Gap Kritis
- **Tidak ada satupun integrasi visual/video/audio generation.**
- `packages/shared` masih tipis — belum ada kontrak tipe untuk asset visual, job antrian media, atau relasi karakter-ke-video.
- Belum ada struktur untuk "beberapa video dengan karakter sama" — `Episode` di sistem lama terikat ke `Season` dalam satu universe naratif panjang, bukan didesain untuk video pendek lintas-cerita dengan karakter yang sama tapi premis berbeda-beda.
- Belum ada modul composition/editing, TTS, atau content moderation layer sama sekali — sistem lama tidak punya konsep "rating audiens per-universe".

### Kesimpulan
Repo ini adalah **AI Story/Bible Engine yang solid**. Untuk jadi AI Video Factory, gap utamanya bukan cuma "belum ada generator visual/audio" — tapi juga **belum ada struktur data untuk karakter yang reusable lintas video-video pendek independen**. Dua hal ini yang jadi fokus desain.

---

## 2. Arsitektur yang Direkomendasikan

### 2.1 Struktur Folder

```
suro-buya/
├── apps/
│   ├── web/
│   ├── cli/
│   └── video-worker/             # 🆕 Temporal worker + rendering trigger
│
├── packages/
│   ├── shared/                   # + video types (lihat 2.2)
│   ├── engine-v2/
│   │   └── src/
│   │       ├── ai/
│   │       │   └── media-providers/   # 🆕 image/video/voice provider adapters
│   │       ├── character/             # 🆕 "Create New Character" engine
│   │       │   ├── persona-parser.ts     # 🆕 free-text → structured persona draft (AI)
│   │       │   ├── character-builder.ts  # gabung persona draft + Character Bible existing
│   │       │   ├── reference-generator.ts
│   │       │   └── character-validator.ts
│   │       ├── script/                # naskah per episode video
│   │       ├── storyboard/
│   │       ├── visual/
│   │       ├── motion/
│   │       ├── audio/
│   │       ├── compose/
│   │       ├── validate/
│   │       │   ├── canon.ts              # (existing) — dipakai ulang utk video
│   │       │   └── safety-review.ts      # 🆕 content moderation generik (lihat 2.3.1) — bukan hardcode child-safety
│   │       ├── batch/
│   │       └── skills/                # (existing) tetap
│   │
│   ├── video-renderer/           # 🆕 Remotion/FFmpeg rendering
│   ├── templates/                # + video templates
│   └── ui/                       # + video UI components
```

### 2.2 Update `packages/shared/src/types/`

- `MediaJob` — job async media generation, dipetakan ke Temporal.
- `CharacterVisualProfile` — reference images, style tags, palette. **Bukan** pengganti persona — persona tetap di Character Bible.
- `ShotSpec` — camera angle, duration, dialogue, visual/motion prompt.
- `VideoAsset` — metadata output final.
- `PersonaDraft` — 🆕 hasil strukturisasi AI dari input teks bebas, sebelum direview jadi Character Bible entry permanen (lihat 2.4).

### 2.3 Perluasan Data Model — Karakter Terhubung ke Bible, Bukan Berdiri Sendiri

Ini revisi paling penting dari draft sebelumnya. `CharacterAsset` **bukan** tabel independen dengan persona versi ringan — dia adalah *lapisan visual/produksi* di atas `Character` yang sudah ada di Character Bible.

```prisma
// CharacterAsset melengkapi Character existing, TIDAK menduplikasi field persona
model CharacterAsset {
  id              String   @id @default(cuid())
  characterId     String   @unique          // relasi 1:1 ke Character existing (sumber persona)
  referenceImages String[]                  // visual DNA — mekanisme konsistensi default
  voiceProfile    Json?                     // TTS voice_id + settings
  loraConfig      Json?                     // opsional, Phase VF-6 saja
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// 🆕 Menaungi beberapa video/episode dengan karakter yang sama — continuity
model VideoSeries {
  id           String   @id @default(cuid())
  universeId   String
  title        String
  characterIds String[]           // karakter utama yang muncul lintas episode series ini
  createdAt    DateTime @default(now())
}

model VideoProject {
  id          String       @id @default(cuid())
  universeId  String
  seriesId    String?                 // null = video standalone, diisi = bagian dari VideoSeries
  characterId String
  episodeOrder Int?                   // urutan dalam series, jika ada
  title       String
  script      String       @db.Text
  storyboard  Json                    // ShotSpec[]
  status      VideoStatus  @default(DRAFT)
  settings    Json
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

// 🆕 Extend Universe existing — audiens/rating ditentukan per-universe,
// TIDAK ada default hardcode di level engine (lihat Prinsip #4)
enum ContentRating {
  ALL_AGES    // aman untuk segala umur, termasuk anak-anak
  TEEN        // remaja ke atas
  MATURE      // dewasa — tema berat, boleh menegangkan/kompleks
}

// Tambahan field ke model Universe existing (bukan model baru):
//   contentRating   ContentRating @default(ALL_AGES)
//   audienceProfile String?       // deskripsi bebas, mis. "keluarga Indonesia, tema edukatif"
//                                  // — dipakai persona-parser.ts & safety-review.ts (lihat 2.3.1)
```

### 2.3.1 Content Moderation — Generik, Bukan Child-Safety Spesifik

`safety-review.ts` (VF-5.1) didesain dua lapis, tidak ada yang mengasumsikan audiens anak-anak secara default:

1. **Baseline platform policy** — berlaku ke SEMUA universe apapun rating-nya: larangan konten ilegal, ujaran kebencian terhadap kelompok terlindungi, konten seksual non-konsensual, promosi kekerasan nyata. Ini standar trust & safety platform, bukan aturan khusus anak.
2. **Rating-consistency check** — membandingkan output video dengan `Universe.contentRating` yang dideklarasikan creator-nya sendiri. Kalau universe dideklarasikan `ALL_AGES` (seperti Suro & Buya) tapi menghasilkan konten yang tidak cocok (mis. terlalu menegangkan), ini di-flag sebagai **warning untuk creator**, bukan hard-block otomatis — karena rating itu keputusan creator, sistem cuma membantu konsistensi terhadap rating yang mereka pilih sendiri.

`persona-parser.ts` (VF-1.2, sudah diimplementasikan) menerima `audienceProfile` dari konfigurasi universe pemanggil sebagai parameter opsional — kalau kosong, AI diinstruksikan netral, tidak mengasumsikan segmen usia tertentu.

*(Model `MediaAsset`, `VideoRender` tetap seperti draft sebelumnya. `SafetyReviewLog` tetap ada tapi field `flaggedRule` sekarang bisa merujuk baseline policy ATAU rating-consistency, bukan cuma pola child-safety.)*

### 2.4 Alur "Create New Character" — Two-Step: Free-Text Default + Form Review Wajib

Hasil diskusi: free-text jadi jalur masuk utama (mengurangi beban kognitif di awal), tapi **form review di akhir tidak pernah opsional** — ini yang menjaga canon integrity karena karakter dipakai lintas banyak episode.

```
Step 1 — Concept Input
├─ Opsi A (default): Textarea bebas — "Ceritakan karaktermu"
│   → persona-parser.ts (AI) strukturisasi jadi PersonaDraft
│       (nama, sifat, cara bicara, umur, peran, ketakutan/motivasi)
└─ Opsi B: "Isi form manual" — untuk user yang mau kontrol penuh dari awal
    → langsung isi PersonaDraft tanpa lewat AI parsing

Step 2 — Review & Refine (WAJIB, untuk kedua jalur A maupun B)
→ PersonaDraft ditampilkan sebagai form yang bisa diedit
→ User koreksi field yang salah tangkap AI (jika lewat jalur A)
→ Setelah approve → character-builder.ts menyimpan sebagai Character Bible
  entry permanen (bukan lagi draft) + trigger reference-generator.ts

Step 3 — Reference Image
→ Generate 3-5 reference image dari persona yang sudah final
→ User approve/regenerate → tersimpan sebagai CharacterAsset
```

Kenapa Step 2 wajib untuk kedua jalur: kesalahan kecil di strukturisasi awal (AI salah tangkap trait minor padahal itu inti konflik karakter) akan terbawa ke semua episode berikutnya kalau tidak dikoreksi di titik ini.

### 2.5 Web App — Module Baru

```
apps/web/src/app/(dashboard)/[universeId]/
├── characters/
│   └── new/                    # wizard 2-step di atas (bukan form CRUD biasa)
├── studio/
│   └── [projectId]/            # workspace produksi 1 video/episode
├── series/                     # 🆕 kelola VideoSeries — daftar episode per series
└── batch/
```

---

## 3. Flow User Journey (Updated)

```
1. Pilih Universe → Pilih Karakter EXISTING atau "Create New Character"
   (lihat alur two-step lengkap di 2.4)

2. Pilih konteks video:
   ├─ Video standalone (tidak terikat series), ATAU
   └─ Tambah ke VideoSeries existing / buat VideoSeries baru
      → jika series, sistem otomatis muat konteks episode sebelumnya
        untuk continuity (reuse ContextBuilder existing)

3. Input Naskah/Ide Cerita per episode
   → Age-appropriateness check
   → Canon check terhadap persona karakter yang sudah di-lock (CanonValidator, reused)

4. Storyboard & Scene Breakdown (otomatis)

5. Visual Generation — pakai reference image dari CharacterAsset

6. Animation/Motion Generation

7. Voice Over & Audio — pakai voice profile dari CharacterAsset

8. Video Editing & Composition

9. Canon Validation & Safety Review
   → Cek konsistensi persona vs Character Bible (bukan cuma safety)
   → Cek continuity vs episode sebelumnya jika bagian dari VideoSeries
   → Human-in-the-loop approval

10. Batch Generation & Export
```

---

## 4. Rekomendasi Tools AI per Tahap — FINAL (kondisi Agustus 2026)

*(Tidak berubah dari kesepakatan sebelumnya — dicantumkan ulang untuk referensi lengkap dalam satu dokumen.)*

| Tahap | Kategori | Provider Pilihan | Alasan |
|---|---|---|---|
| Persona/Character Bible | LLM struktur data | Claude — `persona-parser.ts` strukturisasi free-text jadi PersonaDraft | Reuse `ai/providers.ts` |
| Script Generator | LLM | Claude | Provider-agnostic |
| Storyboard | LLM + structured output | Claude (JSON mode) | — |
| Visual Generation | Image + reference-conditioning | Flux 2 Pro / Nano Banana 2 (hingga 14 reference image) | Default konsistensi karakter tanpa training |
| Motion/Animation | Image-to-video | Kling 3.0 (primary) → Seedance 2 → Wan 2.7 (fallback chain) | Unggul short-form vertical; Sora sudah dihentikan OpenAI |
| Voice Over & Audio | TTS + music | ElevenLabs/Cartesia (wajib uji kualitas suara Bahasa Indonesia untuk rentang karakter tiap universe) + Suno/Udio | Rentang suara diuji sesuai kebutuhan universe masing-masing — bisa anak (mis. Suro & Buya), bisa dewasa, tergantung persona karakter |
| Composition | Rendering | Remotion + FFmpeg | Type-safe, programmatic |
| Canon & Safety | Rule engine + LLM Judge | `CanonValidator` (reused) + `safety-review.ts` (baseline platform policy + rating-consistency, lihat 2.3.1) | Cek persona *dan* baseline trust & safety — tidak ada asumsi audiens tertentu di level engine |
| Orchestration | Workflow engine | Temporal | Durable execution, human-in-the-loop native |

---

## 5. Continuity Antar-Episode — Mekanisme

Karena karakter bisa muncul di banyak episode/cerita berbeda, ini yang menjaga konsistensi:

1. **Persona tunggal, dirujuk berkali-kali.** `Character` (Bible) adalah satu-satunya sumber kebenaran. Setiap `VideoProject` baru untuk karakter yang sama merujuk `characterId` yang sama — tidak ada duplikasi persona per video.
2. **Reference image tunggal, dipakai lintas semua video.** `CharacterAsset.referenceImages` tidak digenerate ulang tiap episode — sekali disetujui, dipakai konsisten di semua `VideoProject` untuk karakter tersebut.
3. **`VideoSeries` sebagai penanda continuity naratif.** Kalau cerita di episode 3 perlu tahu apa yang terjadi di episode 1 (bukan cuma konsisten visual, tapi juga plot), `episodeOrder` + relasi ke `VideoSeries` dipakai `ContextBuilder` (reused dari sistem lama) untuk membangun konteks lintas episode saat generate naskah.
4. **`CanonValidator` dijalankan terhadap dua hal**: (a) apakah naskah/shot konsisten dengan persona di Character Bible, dan (b) — kalau bagian dari series — apakah konsisten dengan episode sebelumnya.

---

## 6. Migration Strategy — Extend, Don't Rewrite

```
CURRENT                          →  TARGET
──────────────────────────────────────────────────────────────
Character (Bible)                →  tetap sumber persona; CharacterAsset relasi 1:1 di atasnya
CanonValidator                   →  reused untuk video, tidak ditulis ulang
ContextBuilder                   →  reused untuk continuity antar-episode video
packages/shared/types.ts         →  + video types + PersonaDraft
packages/engine-v2/src/          →  + character/, script/, storyboard/, visual/, motion/,
                                     audio/, compose/, batch/
apps/web/.../[universeId]/       →  + characters/new/, studio/, series/, batch/
apps/video-worker/               →  BARU
packages/video-renderer/         →  BARU
```

Prinsip: model dan modul lama tidak dihapus atau ditulis ulang dari nol — fondasi existing (`Character`, `CanonValidator`, `ContextBuilder`, RBAC, auth) dipertahankan dan diadaptasi non-breaking di mana struktur data baru (`CharacterAsset`, `VideoSeries`) atau alur baru (persona wizard, media pipeline) menuntutnya, sambil menjaga semantik canon. `CharacterAsset` dan `VideoSeries` adalah lapisan tambahan di atas `Character`/`Episode`/`Season` yang sudah ada.
