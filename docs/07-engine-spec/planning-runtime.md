# 08-engine-spec/planning-runtime.md

# Planning Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Planning Runtime bertanggung jawab mengubah intent dan context yang telah disiapkan menjadi **rencana (plan)** yang terstruktur sebelum proses generation dimulai.

Planning Runtime adalah tahap berpikir (reasoning) AI Engine. Ia menentukan **apa yang akan dibuat**, bukan **bagaimana teks akhirnya ditulis**.

Planning Runtime tidak menghasilkan narasi akhir, dialog, maupun aset produksi.

Output utamanya adalah blueprint yang akan digunakan oleh Generation Runtime.

---

# 2. Goals

Planning Runtime harus mampu:

- memahami intent Creator
- menganalisis context
- membangun objective
- menyusun story plan
- menyusun episode plan
- menyusun scene plan
- menentukan karakter aktif
- menentukan lokasi
- menentukan timeline
- menghasilkan execution blueprint yang siap digenerate

---

# 3. Responsibilities

Planning Runtime bertanggung jawab terhadap:

- Intent Analysis
- Goal Definition
- Story Planning
- Episode Planning
- Scene Planning
- Character Planning
- Timeline Planning
- Conflict Planning
- Continuity Planning
- Planning Metrics

---

# 4. High Level Architecture

```text
               Orchestrator

                     │

             Planning Runtime

      ┌──────────────┼──────────────┐

      │              │              │

 Goal Builder   Story Planner   Scene Planner

      │              │              │

      └──────────────┼──────────────┘

                     │

            Planning Blueprint
```

---

# 5. Planning Pipeline

```text
Receive Intent

↓

Analyze Context

↓

Define Goal

↓

Build Story Plan

↓

Build Episode Plan

↓

Build Scene Plan

↓

Check Continuity

↓

Return Planning Blueprint
```

Planning dilakukan sebelum Generation Runtime dijalankan.

---

# 6. Planning Levels

Planning Runtime bekerja pada beberapa tingkat.

```
Universe

↓

Story

↓

Season

↓

Episode

↓

Scene
```

Setiap level hanya boleh bergantung pada level di atasnya.

---

# 7. Goal Definition

Planning dimulai dengan mendefinisikan tujuan.

Contoh:

```
Intent

↓

Create Episode 5
```

Goal:

```
Membuat Episode 5
yang konsisten
dengan Story Bible
dan Season Bible.
```

Goal menjadi acuan seluruh proses planning.

---

# 8. Story Planning

Story Planning menentukan posisi episode dalam keseluruhan cerita.

Contoh:

- arc aktif
- konflik utama
- perkembangan karakter
- tujuan episode
- konsekuensi terhadap episode berikutnya

Story Planning tidak menghasilkan adegan.

---

# 9. Episode Planning

Episode Planning menghasilkan struktur episode.

Contoh:

```text
Opening

↓

Conflict

↓

Escalation

↓

Climax

↓

Resolution
```

Struktur dapat berbeda sesuai aturan Story Bible.

---

# 10. Scene Planning

Scene Planning memecah episode menjadi daftar scene.

Contoh:

```text
Scene 1

Lokasi:
Pasar

Karakter:
Suro
Buya

Tujuan:
Memperkenalkan konflik
```

Scene Planning belum menghasilkan narasi.

---

# 11. Character Planning

Planning Runtime menentukan:

- karakter yang muncul
- alasan kemunculan
- tujuan karakter
- relasi antar karakter
- perubahan emosi
- batas perilaku berdasarkan Character Bible

Karakter tidak boleh muncul tanpa alasan yang jelas dalam cerita.

---

# 12. Timeline Planning

Planning Runtime memastikan:

- urutan waktu benar
- tidak ada kontradiksi
- umur karakter sesuai
- hubungan antar peristiwa konsisten
- tidak ada lompatan waktu yang tidak dijelaskan

Timeline berasal dari Story Bible dan Episode History.

---

# 13. Location Planning

Planning Runtime menentukan:

- lokasi scene
- urutan perpindahan lokasi
- aturan dunia yang berlaku
- batas geografis

Lokasi harus berasal dari World Bible.

---

# 14. Conflict Planning

Planning Runtime menyusun konflik.

Contoh:

```text
Internal Conflict

↓

Character Development
```

atau

```text
External Conflict

↓

Story Progression
```

Konflik harus mendukung tujuan episode.

---

# 15. Continuity Planning

Planning Runtime memeriksa:

- kesinambungan cerita
- kesinambungan karakter
- kesinambungan timeline
- kesinambungan hubungan
- kesinambungan lokasi
- kesinambungan visual

Jika ditemukan konflik dengan canon, planning harus diperbaiki sebelum generation dimulai.

---

# 16. Planning Blueprint

Output utama Planning Runtime adalah Planning Blueprint.

Contoh:

```text
Episode Goal

Story Position

Episode Structure

Scene List

Character List

Timeline

Locations

Conflict Map

Continuity Notes
```

Blueprint ini menjadi satu-satunya masukan utama bagi Generation Runtime.

---

# 17. Planning Events

Planning Runtime menghasilkan event:

```text
PlanningStarted

GoalDefined

StoryPlanned

EpisodePlanned

ScenePlanned

ContinuityChecked

PlanningCompleted
```

Event digunakan untuk monitoring dan audit.

---

# 18. Planning Metrics

Planning Runtime mencatat:

- Planning ID
- Workflow ID
- Goal
- Scene Count
- Character Count
- Timeline Reference
- Planning Duration
- Continuity Score
- Canon Coverage
- Warning Count

---

# 19. Error Handling

Jenis kesalahan:

### Missing Context

Bible yang diperlukan belum tersedia.

↓

Minta Retrieval Runtime mengambil data.

---

### Invalid Goal

Intent tidak dapat diterjemahkan menjadi tujuan yang jelas.

↓

Kembalikan ke Orchestrator.

---

### Continuity Conflict

Planning bertentangan dengan canon.

↓

Perbaiki planning.

↓

Jalankan ulang pemeriksaan.

---

### Missing Character

Karakter yang dibutuhkan tidak ditemukan.

↓

Laporkan ke Orchestrator.

---

### Invalid Timeline

Urutan waktu tidak konsisten.

↓

Batalkan planning.

↓

Bangun ulang timeline.

---

# 20. Configuration

Planning Runtime mendukung konfigurasi:

- Maximum Scene Count
- Maximum Character Count
- Planning Depth
- Continuity Level
- Canon Strictness
- Story Progression Policy
- Timeline Policy
- Logging Level

---

# 21. Interface Contract

### Input

- Intent
- Runtime Context
- Story Bible
- Season Bible
- Episode History
- Planning Configuration

### Output

- Planning Blueprint
- Planning Metrics
- Continuity Notes
- Warning
- Error (jika ada)

Generation Runtime hanya menerima Planning Blueprint, bukan intent secara langsung.

---

# 22. Canon Protection

Planning Runtime wajib memastikan bahwa seluruh rencana yang dihasilkan:

- sesuai dengan Universe Bible
- tidak mengubah fakta canon
- tidak menciptakan karakter baru di luar aturan
- tidak mengubah timeline resmi
- tidak memindahkan lokasi tanpa dasar
- tidak mengubah hubungan antar karakter

Apabila terdapat ketidaksesuaian, planning harus dihentikan sebelum memasuki tahap generation.

---

# 23. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Memulai proses planning |
| Retrieval Runtime | Menyediakan Bible dan referensi |
| Memory Runtime | Menyediakan working memory |
| Context Runtime | Menyusun context yang siap digunakan |
| Generation Runtime | Menggunakan Planning Blueprint untuk menghasilkan konten |
| Validation Runtime | Memvalidasi blueprint bila diperlukan dan hasil generation |
| Review Runtime | Menggunakan blueprint sebagai acuan evaluasi |

Planning Runtime menjadi jembatan antara pengetahuan (knowledge) dan proses kreatif (generation).

---

# 24. Success Criteria

Planning Runtime dianggap berhasil apabila:

- goal berhasil ditentukan
- struktur cerita tersusun
- struktur episode lengkap
- seluruh scene telah direncanakan
- karakter dan lokasi telah ditentukan
- timeline konsisten
- tidak ada konflik dengan canon
- Planning Blueprint berhasil dibentuk
- blueprint siap digunakan oleh Generation Runtime

---

# 25. Summary

Planning Runtime adalah "otak perencana" AI Engine Suro & Buya.

Ia mengubah intent dan context menjadi Planning Blueprint yang mendefinisikan tujuan cerita, struktur episode, daftar scene, karakter, lokasi, timeline, dan konflik. Dengan memisahkan tahap perencanaan dari tahap generation, engine mampu menghasilkan cerita yang lebih konsisten, mudah diaudit, dan selalu berlandaskan Universe Bible.