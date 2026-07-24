# 08-engine-spec/workflow-runtime.md

# Workflow Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Workflow Runtime bertanggung jawab mengelola **alur kerja (workflow)** yang dijalankan oleh AI Engine Suro & Buya.

Berbeda dengan **Execution Runtime** yang berfokus pada eksekusi task, Workflow Runtime berfokus pada **struktur proses bisnis** yang harus dilalui untuk menyelesaikan sebuah intent.

Workflow Runtime mendefinisikan:

- tahapan workflow
- transisi antar tahap
- aturan percabangan
- kondisi masuk dan keluar setiap tahap
- aturan penyelesaian workflow

Workflow Runtime **tidak menjalankan task secara langsung**, tetapi mengendalikan bagaimana task-task tersebut disusun menjadi sebuah proses yang utuh.

---

# 2. Goals

Workflow Runtime harus mampu:

- memilih workflow yang sesuai
- mengelola lifecycle workflow
- mengatur perpindahan antar stage
- memastikan urutan proses sesuai aturan
- mendukung workflow bercabang
- mendukung workflow bertingkat (nested workflow)
- menangani kegagalan workflow
- mendukung resume dari checkpoint
- menghasilkan status workflow yang dapat diaudit

---

# 3. Responsibilities

Workflow Runtime bertanggung jawab terhadap:

- Workflow Definition
- Workflow State
- Stage Transition
- Conditional Flow
- Nested Workflow
- Workflow Recovery
- Workflow Completion
- Workflow Metrics
- Workflow Event

---

# 4. High Level Architecture

```
                  Orchestrator

                       │

               Workflow Runtime

                       │

          Workflow Definition Engine

                       │

      ┌────────────────┼────────────────┐

      │                │                │

 Workflow State   Transition Engine   Rule Engine

      │                │                │

      └────────────────┼────────────────┘

                       │

              Execution Runtime
```

---

# 5. Workflow Definition

Workflow adalah kumpulan stage yang memiliki tujuan tertentu.

Contoh:

```
Episode Creation Workflow

↓

Retrieve Bible

↓

Build Context

↓

Episode Planning

↓

Scene Generation

↓

Dialogue Generation

↓

Validation

↓

Review

↓

Production
```

Workflow disimpan sebagai definisi, bukan sebagai kode program.

---

# 6. Workflow Types

Engine mendukung beberapa workflow utama.

### Episode Creation

```
Intent

↓

Episode
```

---

### Story Development

```
Intent

↓

Story
```

---

### Review Workflow

```
Intent

↓

Review
```

---

### Production Workflow

```
Intent

↓

Production
```

---

Workflow lain dapat ditambahkan tanpa mengubah Workflow Runtime.

---

# 7. Workflow Lifecycle

Setiap workflow memiliki lifecycle berikut:

```
CREATED

↓

INITIALIZED

↓

RUNNING

↓

WAITING

↓

COMPLETED
```

Apabila terjadi kegagalan:

```
FAILED

↓

RECOVERING

↓

RUNNING

atau

ABORTED
```

---

# 8. Workflow Stage

Workflow terdiri dari beberapa stage.

Contoh Episode Workflow:

```
Stage 1

Retrieval

↓

Stage 2

Context Building

↓

Stage 3

Planning

↓

Stage 4

Generation

↓

Stage 5

Validation

↓

Stage 6

Review

↓

Stage 7

Production
```

Stage merupakan unit logis yang terdiri atas satu atau lebih task.

---

# 9. Stage Lifecycle

Setiap stage memiliki status:

```
PENDING

↓

READY

↓

ACTIVE

↓

COMPLETED
```

Jika gagal:

```
FAILED

↓

RETRY

↓

ACTIVE

↓

FAILED

↓

ROLLBACK
```

---

# 10. Stage Transition

Workflow Runtime menentukan kapan sebuah stage dapat dijalankan.

Contoh:

```
Planning

↓

Generation
```

Hanya terjadi jika:

- Planning selesai
- Context valid
- Tidak ada pelanggaran canon

Jika syarat belum terpenuhi, workflow tetap berada pada stage saat ini.

---

# 11. Conditional Workflow

Workflow dapat memiliki percabangan.

Contoh:

```
Validation

↓

Passed

↓

Review
```

atau

```
Validation

↓

Failed

↓

Generation
```

Percabangan selalu ditentukan oleh aturan bisnis, bukan oleh runtime secara acak.

---

# 12. Nested Workflow

Workflow dapat memanggil workflow lain.

Contoh:

```
Episode Workflow

↓

Scene Workflow

↓

Dialogue Workflow
```

Atau:

```
Production Workflow

↓

Storyboard Workflow

↓

Voice Workflow
```

Nested workflow tetap dikendalikan oleh Workflow Runtime yang sama.

---

# 13. Workflow Context

Workflow Runtime membawa context tingkat workflow.

Contoh:

- Workflow ID
- Intent
- Target Object
- Runtime Configuration
- Bible Context Reference
- Execution Reference
- User Parameters

Context detail tetap dikelola oleh Context Runtime.

---

# 14. Workflow Rules

Workflow Runtime memastikan:

- urutan workflow benar
- dependency antar stage terpenuhi
- tidak ada stage yang dilewati
- transisi sesuai aturan
- seluruh output tervalidasi sebelum lanjut

---

# 15. Workflow Event

Workflow menghasilkan event berikut:

```
WorkflowStarted

StageStarted

StageCompleted

StageFailed

StageRetried

WorkflowPaused

WorkflowResumed

WorkflowCompleted

WorkflowAborted
```

Event digunakan untuk observabilitas dan koordinasi dengan Orchestrator.

---

# 16. Workflow Recovery

Jika workflow gagal:

```
Stage 5

FAILED
```

Workflow Runtime melakukan:

```
Recovery

↓

Resume

↓

Stage 5
```

Stage sebelumnya tidak diulang jika checkpoint masih valid.

---

# 17. Workflow Rollback

Rollback dilakukan ketika hasil suatu stage tidak lagi valid.

Contoh:

```
Validation

↓

Canon Violation

↓

Rollback

↓

Generation
```

Rollback dilakukan ke stage yang menjadi penyebab masalah, bukan ke awal workflow.

---

# 18. Checkpoint Strategy

Checkpoint dibuat setelah stage penting.

Contoh:

```
Retrieval Complete

↓

Checkpoint
```

```
Planning Complete

↓

Checkpoint
```

```
Generation Complete

↓

Checkpoint
```

```
Validation Complete

↓

Checkpoint
```

Checkpoint digunakan untuk recovery dan audit.

---

# 19. Workflow Metrics

Workflow Runtime mencatat:

- Workflow ID
- Workflow Type
- Total Stage
- Completed Stage
- Failed Stage
- Retry Count
- Rollback Count
- Recovery Count
- Total Duration
- Average Stage Duration
- Success Rate

---

# 20. Error Handling

Jenis kesalahan:

### Invalid Workflow

Workflow tidak ditemukan.

↓

Abort.

---

### Transition Error

Stage berpindah tanpa memenuhi syarat.

↓

Tolak transisi.

---

### Rule Violation

Melanggar aturan workflow.

↓

Rollback.

---

### Dependency Error

Stage bergantung pada stage yang belum selesai.

↓

Menunggu.

---

### Runtime Error

Execution Runtime gagal menyelesaikan task.

↓

Recovery.

---

# 21. Configuration

Workflow Runtime mendukung konfigurasi berikut:

- Workflow Timeout
- Maximum Retry
- Maximum Rollback
- Auto Resume
- Checkpoint Policy
- Parallel Stage Policy
- Event Policy
- Logging Level

---

# 22. Interface Contract

### Input

- Workflow ID
- Workflow Definition
- Intent
- Execution Reference
- Runtime Configuration

### Output

- Workflow Status
- Active Stage
- Stage Result
- Workflow Metrics
- Workflow Event
- Error Information (jika ada)

---

# 23. Canon Enforcement

Workflow Runtime tidak memvalidasi canon secara langsung, tetapi memastikan bahwa:

- setiap stage yang menghasilkan konten wajib diteruskan ke Validation Runtime
- workflow tidak dapat melanjutkan ke stage berikutnya apabila status validasi gagal
- tidak ada mekanisme untuk melewati Validation Runtime
- hasil review menjadi syarat sebelum memasuki Production

Dengan demikian, kepatuhan terhadap Universe Bible menjadi bagian dari alur workflow, bukan pilihan opsional.

---

# 24. Relationship with Other Runtimes

Workflow Runtime bekerja sama dengan runtime lain sebagai berikut:

| Runtime | Peran |
|---------|------|
| Orchestrator | Memilih dan memulai workflow |
| Execution Runtime | Menjalankan task pada setiap stage |
| Retrieval Runtime | Mengambil Bible dan referensi |
| Context Runtime | Menyusun runtime context |
| Planning Runtime | Menyusun rencana cerita |
| Generation Runtime | Menghasilkan konten |
| Validation Runtime | Memeriksa kepatuhan canon |
| Review Runtime | Menyusun paket review |
| Production Runtime | Menyiapkan aset produksi |

Workflow Runtime menjadi penghubung logis di antara seluruh runtime tersebut.

---

# 25. Success Criteria

Workflow Runtime dianggap berhasil apabila:

- workflow yang benar dipilih
- seluruh stage dijalankan sesuai urutan
- seluruh transisi memenuhi aturan
- dependency dipatuhi
- recovery dan rollback berjalan sesuai konfigurasi
- checkpoint berhasil dibuat
- seluruh event workflow dipublikasikan
- status workflow akhir dikembalikan ke Orchestrator
- tidak ada proses yang melewati validasi canon

---

# 26. Summary

Workflow Runtime adalah pengelola proses bisnis AI Engine Suro & Buya.

Ia mendefinisikan bagaimana sebuah intent berubah menjadi serangkaian stage yang terstruktur, mengendalikan transisi, percabangan, recovery, rollback, dan penyelesaian workflow. Dengan memisahkan workflow dari eksekusi task, engine menjadi lebih modular, mudah dikembangkan, dan tetap menjaga konsistensi terhadap Universe Bible.