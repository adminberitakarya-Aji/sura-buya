# 08-engine-spec/orchestrator.md

# AI Engine Orchestrator Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Orchestrator adalah pusat eksekusi seluruh AI Engine Suro & Buya.

Ia bertanggung jawab mengubah sebuah intent dari Creator menjadi serangkaian workflow yang terstruktur hingga menghasilkan Production Package yang siap diproduksi.

Orchestrator **tidak menghasilkan konten**.

Ia hanya:

- mengatur workflow
- memilih runtime yang tepat
- mengatur state
- mengelola context
- mengatur dependency
- melakukan recovery ketika terjadi kegagalan
- memastikan seluruh proses selalu mengikuti Universe Bible.

---

# 2. Goals

Orchestrator harus mampu:

- menerima intent
- menentukan workflow
- membangun execution plan
- menjalankan runtime secara berurutan
- melakukan validasi di setiap tahap
- menangani retry
- menangani rollback
- menghasilkan execution log
- menghasilkan review package
- meneruskan hasil ke production

---

# 3. Design Principles

## Bible First

Semua keputusan berasal dari Bible.

Tidak ada runtime yang boleh mengabaikan Bible.

---

## Stateless Execution

Setiap runtime bersifat stateless.

Seluruh state disimpan oleh Orchestrator.

---

## Deterministic

Input yang sama

+

Bible yang sama

+

Configuration yang sama

↓

harus menghasilkan output yang konsisten.

---

## Modular

Setiap runtime dapat diganti tanpa mengubah workflow utama.

---

## Recoverable

Workflow dapat dilanjutkan setelah gagal.

---

## Observable

Seluruh langkah memiliki log dan trace.

---

# 4. Responsibilities

Orchestrator bertanggung jawab terhadap:

- Intent Processing
- Workflow Selection
- Runtime Scheduling
- Context Injection
- Bible Injection
- Memory Coordination
- State Management
- Retry Management
- Rollback
- Validation Trigger
- Review Trigger
- Production Trigger

---

# 5. High Level Architecture

```
                Creator

                   │

              User Intent

                   │

            Intent Processor

                   │

          Execution Planner

                   │

          Workflow Scheduler

                   │

      ┌────────────┼────────────┐

      │            │            │

 Retrieval     Planning     Generation

      │            │            │

      └────────────┼────────────┘

                   │

            Validation Runtime

                   │

           Consistency Runtime

                   │

            Review Runtime

                   │

         Production Runtime

                   │

          Production Package
```

---

# 6. Internal Components

## Intent Processor

Mengidentifikasi:

- tujuan
- target object
- operation
- parameter

Contoh:

```
Create Episode 5
```

↓

```
Object:
Episode

Operation:
Create

Parameter:
Episode Number = 5
```

---

## Execution Planner

Membangun execution plan.

Contoh:

```
Retrieve Story

↓

Retrieve Season

↓

Retrieve Character

↓

Retrieve World

↓

Build Context

↓

Generate Outline

↓

Generate Scene

↓

Generate Dialogue

↓

Validate

↓

Review

↓

Production
```

---

## Workflow Scheduler

Menentukan urutan runtime.

Scheduler memastikan dependency telah terpenuhi.

Misalnya:

Scene Generator

tidak boleh dijalankan sebelum

Episode Planner selesai.

---

## Context Manager

Menyusun seluruh context runtime.

Contoh:

Universe Bible

+

Story Bible

+

Season Bible

+

Episode History

+

Character Bible

+

Relationship

+

Visual Rule

↓

Runtime Context

---

## State Manager

Menyimpan seluruh execution state.

Contoh:

```
STARTED

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

FINISHED
```

---

## Runtime Dispatcher

Memanggil runtime sesuai urutan.

Misalnya:

```
Retrieval Runtime

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
```

---

## Retry Manager

Jika runtime gagal.

Contoh:

```
Dialogue Runtime gagal

↓

Retry

↓

Retry

↓

Still Fail

↓

Abort Workflow
```

---

## Rollback Manager

Jika workflow tidak dapat dilanjutkan.

Rollback mengembalikan state terakhir yang valid.

---

## Event Bus

Mengirim event antar runtime.

Contoh:

```
Episode Planned

↓

Scene Generated

↓

Dialogue Finished

↓

Validation Passed
```

---

## Logger

Mencatat:

- execution
- warning
- validation
- review
- error
- retry

---

# 7. Execution Flow

```
Receive Intent

↓

Validate Intent

↓

Select Workflow

↓

Retrieve Bible

↓

Build Context

↓

Create Execution Plan

↓

Execute Runtime

↓

Validate Result

↓

Review

↓

Production

↓

Complete
```

---

# 8. Runtime Pipeline

Pipeline standar Orchestrator adalah:

```
Intent Runtime

↓

Retrieval Runtime

↓

Context Runtime

↓

Planning Runtime

↓

Generation Runtime

↓

Validation Runtime

↓

Consistency Runtime

↓

Review Runtime

↓

Production Runtime
```

Setiap runtime hanya menerima input dari Orchestrator dan mengembalikan output ke Orchestrator. Runtime tidak saling berkomunikasi secara langsung untuk menjaga modularitas dan kontrol eksekusi.

---

# 9. State Machine

```
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

State kegagalan:

```
FAILED

↓

RETRYING

↓

RECOVERING

↓

ROLLBACK

↓

ABORTED
```

---

# 10. Context Ownership

Orchestrator adalah satu-satunya pemilik context eksekusi.

Runtime tidak menyimpan context permanen.

Context dapat terdiri dari:

- Universe Bible
- Character Bible
- World Bible
- Story Bible
- Season Bible
- Episode History
- Timeline
- Canon Rules
- Visual Rules
- Dialogue Rules
- Production Rules
- Runtime Configuration
- User Intent

---

# 11. Dependency Management

Orchestrator memastikan dependency terpenuhi sebelum runtime dijalankan.

Contoh:

```
Episode Planner

↓

Scene Generator

↓

Dialogue Generator
```

Jika `Episode Planner` gagal, maka `Scene Generator` tidak akan dijalankan.

---

# 12. Error Handling

Jenis kegagalan:

### Intent Error

Intent tidak dikenali.

↓

Stop.

---

### Retrieval Error

Bible tidak ditemukan.

↓

Retry.

↓

Abort jika tetap gagal.

---

### Planning Error

Outline tidak dapat dibentuk.

↓

Retry.

↓

Review Manual.

---

### Generation Error

Konten gagal dihasilkan.

↓

Retry.

↓

Rollback.

---

### Validation Error

Canon dilanggar.

↓

Kembali ke tahap Generation dengan informasi pelanggaran sebagai umpan balik.

---

### Production Error

Package gagal dibentuk.

↓

Retry.

↓

Abort.

---

# 13. Observability

Setiap eksekusi menghasilkan:

- Execution ID
- Workflow ID
- Runtime ID
- Start Time
- End Time
- Duration
- Runtime Status
- Retry Count
- Validation Report
- Review Report
- Production Report

Seluruh log harus dapat ditelusuri untuk kebutuhan audit dan debugging.

---

# 14. Configuration

Parameter utama Orchestrator:

- Maximum Retry
- Runtime Timeout
- Parallel Task Limit
- Context Size Limit
- Validation Level
- Review Level
- Logging Level
- Production Mode
- Auto Recovery
- Auto Rollback

---

# 15. Extensibility

Orchestrator mendukung penambahan runtime baru tanpa mengubah alur utama.

Contoh runtime tambahan:

- Localization Runtime
- Translation Runtime
- Narration Runtime
- Asset Optimization Runtime
- Analytics Runtime

Runtime baru harus mengikuti kontrak input dan output yang ditetapkan oleh Orchestrator.

---

# 16. Security & Canon Enforcement

Orchestrator bertindak sebagai penjaga utama integritas Universe Bible.

Setiap output dari runtime wajib melalui proses validasi sebelum diteruskan ke tahap berikutnya.

Tidak ada runtime yang diizinkan:

- menambah karakter baru tanpa aturan yang ditentukan,
- mengubah fakta canon,
- mengubah timeline,
- mengubah hubungan antar karakter,
- mengubah aturan dunia,
- mengubah identitas visual,
- melewati proses validasi.

Seluruh penyimpangan harus ditolak atau dikembalikan ke tahap yang relevan untuk diperbaiki.

---

# 17. Success Criteria

Sebuah eksekusi dianggap berhasil apabila:

- Intent berhasil dipahami.
- Workflow yang sesuai berhasil dipilih.
- Seluruh Bible berhasil diambil dan disusun menjadi context.
- Semua runtime selesai dieksekusi sesuai urutan.
- Tidak terdapat pelanggaran canon.
- Review menghasilkan status **Approved**.
- Production Package berhasil dibentuk.
- Seluruh proses terdokumentasi dalam execution log yang lengkap dan dapat diaudit.

---

# 18. Summary

Orchestrator adalah pusat kendali AI Engine Suro & Buya.

Ia tidak membuat cerita, dialog, atau aset produksi secara langsung. Tanggung jawabnya adalah memastikan setiap runtime bekerja dalam urutan yang benar, menggunakan context yang benar, mematuhi Universe Bible, dan menghasilkan output yang konsisten, dapat diaudit, serta siap diteruskan ke proses produksi.