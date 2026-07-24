# 08-engine-spec/execution-sequence.md

# AI Engine Execution Sequence Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Execution Sequence mendefinisikan urutan lengkap bagaimana AI Engine Suro & Buya memproses sebuah intent dari Creator hingga menghasilkan Production Package.

Dokumen ini menjadi referensi utama untuk memahami interaksi antar runtime, aliran data, titik validasi, dan keputusan yang diambil selama satu siklus eksekusi.

Execution Sequence tidak menjelaskan implementasi internal setiap runtime, melainkan **bagaimana seluruh runtime bekerja sebagai satu sistem terpadu**.

---

# 2. Design Principles

Seluruh execution sequence mengikuti prinsip berikut:

- Bible First
- Canon First
- Plan Before Generate
- Validate Before Continue
- Review Before Produce
- Production Only After Approval
- Traceable
- Deterministic
- Recoverable

---

# 3. End-to-End Execution Flow

```text
Creator

↓

Intent

↓

Orchestrator

↓

Workflow Runtime

↓

Execution Runtime

↓

Retrieval Runtime

↓

Memory Runtime

↓

Planning Runtime

↓

Generation Runtime

↓

Validation Runtime

↓

Review Runtime

↓

Production Runtime

↓

Production Package

↓

Publish
```

---

# 4. Phase Overview

Seluruh proses dibagi menjadi sembilan fase utama.

| Phase | Runtime | Tujuan |
|--------|---------|--------|
| 1 | Orchestrator | Memulai workflow |
| 2 | Retrieval | Mengambil pengetahuan |
| 3 | Memory | Menyusun context |
| 4 | Planning | Menyusun blueprint |
| 5 | Generation | Menghasilkan konten |
| 6 | Validation | Memastikan kepatuhan canon |
| 7 | Review | Mengevaluasi kualitas |
| 8 | Production | Menyusun Production Package |
| 9 | Publish | Menyerahkan hasil ke pipeline produksi |

---

# 5. Phase 1 — Intent Initialization

Input:

```text
Create Episode 5
```

Orchestrator melakukan:

- memahami intent
- memilih workflow
- membuat Execution Plan
- menginisialisasi Workflow Runtime
- menginisialisasi Execution Runtime

Output:

```text
Execution Plan
```

---

# 6. Phase 2 — Knowledge Retrieval

Retrieval Runtime menerima kebutuhan context.

Contoh:

```text
Universe Bible

Story Bible

Season Bible

Episode History

Character Bible

World Bible
```

Kemudian:

- melakukan retrieval
- melakukan ranking
- melakukan filtering
- menyelesaikan referensi

Output:

```text
Retrieved Context
```

---

# 7. Phase 3 — Context Assembly

Memory Runtime:

- menerima hasil retrieval
- membangun Execution Memory
- membangun Working Memory
- mengompresi context bila perlu
- menyediakan context sesuai kebutuhan runtime berikutnya

Output:

```text
Working Context
```

---

# 8. Phase 4 — Planning

Planning Runtime menerima:

- intent
- Working Context
- Bible
- Episode History

Planning menghasilkan:

```text
Goal

↓

Story Plan

↓

Episode Plan

↓

Scene Plan

↓

Planning Blueprint
```

Blueprint menjadi kontrak bagi seluruh proses generation.

---

# 9. Phase 5 — Content Generation

Generation Runtime menerima:

- Planning Blueprint
- Working Context

Generation dilakukan bertahap.

```text
Scene

↓

Dialogue

↓

Narrative

↓

Visual Description

↓

Episode Draft
```

Output:

```text
Episode Draft
```

---

# 10. Phase 6 — Validation

Validation Runtime menerima:

- Episode Draft
- Planning Blueprint
- Canon References

Validator memeriksa:

- schema
- struktur
- canon
- timeline
- karakter
- dialog
- visual
- kontinuitas

Output:

```text
PASS
```

atau

```text
PASS_WITH_WARNING
```

atau

```text
REGENERATE
```

atau

```text
REJECT
```

---

# 11. Validation Feedback Loop

Jika status:

```text
REGENERATE
```

Orchestrator menjalankan siklus berikut:

```text
Validation Report

↓

Generation Runtime

↓

Partial Regeneration

↓

Validation Runtime
```

Hanya bagian yang gagal divalidasi yang diregenerasi.

Loop berakhir ketika:

- PASS
- PASS_WITH_WARNING
- REJECT
- maksimum regenerasi tercapai

---

# 12. Phase 7 — Review

Review Runtime menerima:

- Validated Episode
- Validation Report

Review mengevaluasi:

- kualitas cerita
- dialog
- pacing
- karakter
- visual
- kesiapan produksi

Output:

```text
APPROVED
```

atau

```text
APPROVED_WITH_NOTES
```

atau

```text
REVISION_REQUIRED
```

atau

```text
REJECTED
```

---

# 13. Review Feedback Loop

Jika status:

```text
REVISION_REQUIRED
```

Orchestrator menentukan ruang lingkup revisi.

Contoh:

```text
Review Notes

↓

Planning Blueprint (jika perlu)

↓

Generation Runtime

↓

Validation Runtime

↓

Review Runtime
```

Revisi dapat berupa:

- dialog
- scene
- visual description
- pacing

Tanpa mengulang workflow secara keseluruhan.

---

# 14. Phase 8 — Production

Production Runtime hanya berjalan apabila Review menghasilkan:

```text
APPROVED
```

atau

```text
APPROVED_WITH_NOTES
```

Production Runtime:

- mengumpulkan artefak
- membangun script final
- membangun storyboard package
- membangun visual package
- membangun voice package
- membuat metadata
- membuat manifest
- membuat Production Package

Output:

```text
Production Package
```

---

# 15. Phase 9 — Publish

AI Engine menyerahkan Production Package kepada pipeline produksi.

Tahap publish berada di luar ruang lingkup AI Engine.

Contoh tujuan:

- Asset Pipeline
- Storyboard Pipeline
- Animation Pipeline
- Voice Pipeline
- Rendering Pipeline

---

# 16. Complete Sequence Diagram

```text
Creator

↓

Intent

↓

Orchestrator

↓

Workflow Runtime

↓

Execution Runtime

↓

Retrieval Runtime

↓

Memory Runtime

↓

Planning Runtime

↓

Generation Runtime

↓

Validation Runtime

      │

      ├──── PASS ──────────────┐
      │                        │
      │                        ▼
      │                  Review Runtime
      │                        │
      │                        ├── APPROVED ─────────► Production Runtime
      │                        │                           │
      │                        │                           ▼
      │                        │                  Production Package
      │                        │
      │                        └── REVISION ─────► Generation Runtime
      │
      └── REGENERATE ─────────► Generation Runtime
```

---

# 17. Runtime Interaction Matrix

| Runtime | Input | Output |
|---------|-------|--------|
| Orchestrator | Intent | Execution Plan |
| Workflow Runtime | Execution Plan | Workflow State |
| Execution Runtime | Workflow State | Task Execution |
| Retrieval Runtime | Retrieval Request | Retrieved Context |
| Memory Runtime | Retrieved Context | Working Context |
| Planning Runtime | Working Context | Planning Blueprint |
| Generation Runtime | Planning Blueprint | Episode Draft |
| Validation Runtime | Episode Draft | Validation Report |
| Review Runtime | Validated Episode | Review Package |
| Production Runtime | Review Package | Production Package |

---

# 18. Execution State Transition

```text
IDLE

↓

INITIALIZING

↓

RETRIEVING

↓

BUILDING_CONTEXT

↓

PLANNING

↓

GENERATING

↓

VALIDATING

↓

REVIEWING

↓

PRODUCTION

↓

COMPLETED
```

Apabila terjadi kegagalan:

```text
FAILED

↓

RETRY

↓

RECOVERY

↓

ROLLBACK

↓

ABORTED
```

---

# 19. Traceability Chain

Seluruh hasil engine harus dapat ditelusuri.

```text
Intent

↓

Execution ID

↓

Workflow ID

↓

Planning Blueprint

↓

Episode Draft

↓

Validation Report

↓

Review Package

↓

Production Package
```

Setiap artefak menyimpan referensi ke artefak sebelumnya sehingga asal-usul setiap keputusan dapat diaudit.

---

# 20. Observability

Selama execution berlangsung, engine menghasilkan:

- Execution Events
- Workflow Events
- Runtime Events
- Metrics
- Logs
- Validation Reports
- Review Reports
- Production Reports

Seluruh data observabilitas dikaitkan dengan Execution ID yang sama.

---

# 21. Recovery Strategy

Jika terjadi kegagalan:

1. Identifikasi checkpoint terakhir.
2. Pulihkan Working Memory dan Execution State.
3. Jalankan kembali runtime yang gagal.
4. Lanjutkan workflow dari checkpoint tersebut.

Recovery tidak mengulang runtime yang telah selesai dan masih valid.

---

# 22. Canon Enforcement Across Pipeline

Kepatuhan terhadap Universe Bible diterapkan di setiap fase:

| Phase | Mekanisme |
|--------|-----------|
| Retrieval | Hanya mengambil data dari repository resmi |
| Memory | Menjaga integritas context |
| Planning | Menyusun blueprint sesuai canon |
| Generation | Menghasilkan konten sesuai blueprint |
| Validation | Memverifikasi kepatuhan canon |
| Review | Mengevaluasi kualitas tanpa mengubah canon |
| Production | Mengemas artefak tanpa memodifikasi konten |

Canon bukan hanya diperiksa di akhir, tetapi menjadi prinsip yang mengendalikan seluruh pipeline.

---

# 23. Success Criteria

Execution Sequence dianggap berhasil apabila:

- intent berhasil diterjemahkan menjadi workflow
- seluruh runtime dijalankan sesuai urutan
- context berasal dari Universe Bible
- Planning Blueprint berhasil dibuat
- Episode Draft berhasil dihasilkan
- seluruh validasi lolos
- Review menghasilkan status APPROVED atau APPROVED_WITH_NOTES
- Production Package berhasil dibangun
- seluruh artefak memiliki traceability
- seluruh metrik, event, dan log tercatat

---

# 24. Summary

Execution Sequence menggambarkan siklus hidup lengkap AI Engine Suro & Buya, mulai dari intent Creator hingga terbentuknya Production Package.

Dokumen ini menjadi peta utama interaksi seluruh runtime—Orchestrator, Workflow, Execution, Retrieval, Memory, Planning, Generation, Validation, Review, dan Production—serta menjelaskan bagaimana setiap tahap saling terhubung melalui context, blueprint, laporan validasi, dan paket review. Dengan alur yang terstruktur, dapat diaudit, dan selalu berlandaskan Universe Bible, AI Engine mampu menghasilkan serial yang konsisten, dapat direproduksi, dan siap diproduksi.