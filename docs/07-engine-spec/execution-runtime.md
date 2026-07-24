# 08-engine-spec/execution-runtime.md

# Execution Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Execution Runtime adalah lapisan yang bertanggung jawab menjalankan seluruh rencana eksekusi (Execution Plan) yang dibuat oleh Orchestrator.

Execution Runtime **tidak mengambil keputusan bisnis**, **tidak menghasilkan konten**, dan **tidak memahami Universe Bible** secara langsung. Tugasnya adalah mengeksekusi langkah-langkah yang telah ditentukan oleh Orchestrator secara aman, konsisten, dan dapat dipulihkan apabila terjadi kegagalan.

Dengan kata lain:

```
Orchestrator
    │
    │ membuat Execution Plan
    ▼
Execution Runtime
    │
    │ menjalankan plan
    ▼
Runtime Modules
```

---

# 2. Goals

Execution Runtime harus mampu:

- menjalankan execution plan
- mengatur urutan eksekusi runtime
- mengelola lifecycle task
- mengelola dependency
- mengelola retry
- mengelola timeout
- mengelola recovery
- mengelola rollback
- mengirim execution event
- melaporkan status ke Orchestrator

---

# 3. Responsibilities

Execution Runtime bertanggung jawab terhadap:

- Task Execution
- Task Scheduling
- Runtime Invocation
- Task State
- Retry Execution
- Timeout Handling
- Dependency Resolution
- Parallel Execution
- Failure Recovery
- Rollback Coordination
- Event Publishing
- Execution Metrics

---

# 4. High Level Architecture

```
               Orchestrator

                     │

             Execution Plan

                     │

           Execution Runtime

      ┌──────────┼──────────┐

      │          │          │

 Scheduler   Dispatcher   Monitor

      │          │          │

      └──────────┼──────────┘

                 │

        Runtime Modules

 Retrieval

 Planning

 Generation

 Validation

 Review

 Production
```

---

# 5. Execution Lifecycle

Setiap task memiliki lifecycle berikut:

```
CREATED

↓

QUEUED

↓

READY

↓

RUNNING

↓

COMPLETED
```

Jika gagal:

```
FAILED

↓

RETRYING

↓

RUNNING

↓

FAILED

↓

ROLLBACK

↓

ABORTED
```

---

# 6. Execution Plan

Execution Plan adalah daftar task yang harus dijalankan.

Contoh:

```text
Task 1
Retrieve Universe Bible

Task 2
Retrieve Character Bible

Task 3
Retrieve Story Bible

Task 4
Build Context

Task 5
Plan Episode

Task 6
Generate Scene

Task 7
Generate Dialogue

Task 8
Validate Canon

Task 9
Review

Task 10
Production Package
```

Execution Runtime tidak mengubah urutan ini.

---

# 7. Task Model

Setiap task memiliki atribut:

```text
Task ID

Runtime

Input

Output

Dependency

Priority

Status

Retry Count

Timeout

Started At

Finished At

Duration
```

Task merupakan unit eksekusi terkecil di dalam engine.

---

# 8. Runtime Invocation

Execution Runtime memanggil runtime berdasarkan tipe task.

Contoh:

```
Retrieve Character Bible

↓

Retrieval Runtime
```

```
Generate Scene

↓

Generation Runtime
```

```
Validate Canon

↓

Validation Runtime
```

Runtime dipanggil melalui kontrak yang seragam sehingga Execution Runtime tidak perlu mengetahui implementasi internal masing-masing runtime.

---

# 9. Dependency Resolution

Task hanya dapat dijalankan apabila seluruh dependency telah selesai.

Contoh:

```
Generate Dialogue

depends on

Generate Scene
```

Diagram:

```
Retrieve Bible

↓

Build Context

↓

Plan Episode

↓

Generate Scene

↓

Generate Dialogue

↓

Validation
```

Jika dependency gagal, task tidak akan dijalankan.

---

# 10. Scheduler

Scheduler bertugas:

- memilih task berikutnya
- memeriksa dependency
- memeriksa status runtime
- menentukan apakah task dapat dijalankan

Scheduler tidak mengetahui isi task.

---

# 11. Dispatcher

Dispatcher bertanggung jawab untuk:

- memilih runtime
- mengirim input
- menerima output
- mengembalikan hasil ke Orchestrator

Contoh:

```
Task

↓

Dispatcher

↓

Generation Runtime

↓

Output
```

---

# 12. Parallel Execution

Execution Runtime mendukung eksekusi paralel hanya untuk task yang independen.

Contoh:

```
Retrieve Universe Bible

||

Retrieve Character Bible

||

Retrieve World Bible
```

Kemudian:

```
Build Context
```

Task yang memiliki dependency tidak boleh dijalankan secara paralel.

---

# 13. Retry Policy

Retry dilakukan untuk kesalahan yang bersifat sementara.

Contoh:

- LLM timeout
- jaringan
- retrieval gagal
- service overload

Urutan:

```
Run

↓

Failed

↓

Retry #1

↓

Retry #2

↓

Retry #3

↓

Abort
```

Jumlah retry ditentukan oleh konfigurasi Orchestrator.

---

# 14. Timeout Handling

Setiap task memiliki batas waktu.

Contoh:

```
Generation Runtime

Timeout

120 detik
```

Jika melebihi batas:

```
Running

↓

Timeout

↓

Retry

atau

Abort
```

---

# 15. Recovery

Execution Runtime mampu melanjutkan proses dari checkpoint terakhir.

Contoh:

```
Task 1

OK

Task 2

OK

Task 3

OK

Task 4

FAILED
```

Recovery:

```
Resume

↓

Task 4
```

Tidak perlu mengulang Task 1–3.

---

# 16. Rollback

Rollback dilakukan jika hasil task tidak lagi valid.

Contoh:

```
Generate Dialogue

↓

Canon Invalid

↓

Rollback

↓

Generate Dialogue
```

Rollback tidak harus kembali ke awal workflow, tetapi ke checkpoint terakhir yang masih valid.

---

# 17. Checkpoint

Checkpoint dibuat setelah task penting selesai.

Contoh checkpoint:

- Context selesai dibangun
- Episode Plan selesai
- Semua Scene selesai
- Semua Dialogue selesai
- Validation selesai
- Review selesai

Checkpoint memungkinkan proses dilanjutkan tanpa mengulang seluruh pipeline.

---

# 18. Event Model

Execution Runtime menghasilkan event pada setiap perubahan status.

Contoh:

```
TaskStarted

TaskCompleted

TaskFailed

TaskRetried

TaskTimeout

TaskRolledBack

WorkflowCompleted
```

Event dikirim ke Event Bus untuk diproses oleh Orchestrator dan sistem observabilitas.

---

# 19. Metrics

Execution Runtime mencatat metrik berikut:

- Execution ID
- Workflow ID
- Task ID
- Runtime
- Start Time
- End Time
- Duration
- CPU Time (opsional)
- Token Usage
- Retry Count
- Timeout Count
- Success Rate
- Failure Rate

Metrik digunakan untuk analisis performa dan optimasi engine.

---

# 20. Error Handling

Jenis kesalahan:

### Runtime Error

Runtime mengembalikan error.

↓

Retry.

---

### Dependency Error

Dependency belum selesai.

↓

Menunggu.

---

### Timeout Error

Task melewati batas waktu.

↓

Retry atau Abort.

---

### Validation Error

Output ditolak oleh Validation Runtime.

↓

Rollback ke task yang relevan.

---

### System Error

Kesalahan internal engine.

↓

Hentikan workflow.

↓

Laporkan ke Orchestrator.

---

# 21. Configuration

Parameter yang dapat dikonfigurasi:

- Max Retry
- Default Timeout
- Maximum Parallel Tasks
- Checkpoint Interval
- Recovery Mode
- Rollback Mode
- Event Publishing
- Metrics Collection
- Logging Level

---

# 22. Interface Contract

Semua runtime wajib mengikuti kontrak berikut:

### Input

- Execution ID
- Task ID
- Runtime Context
- Task Input
- Configuration

### Output

- Status
- Result
- Metadata
- Metrics
- Validation Hint (opsional)
- Error (jika ada)

Kontrak ini memastikan setiap runtime dapat dipanggil secara konsisten oleh Execution Runtime.

---

# 23. Security & Isolation

Execution Runtime harus memastikan:

- setiap task berjalan dalam konteks yang terisolasi
- task tidak dapat mengakses state task lain secara langsung
- runtime tidak dapat memodifikasi execution plan
- hanya Orchestrator yang dapat mengubah workflow
- seluruh akses terhadap Universe Bible dilakukan melalui Retrieval Runtime

Hal ini menjaga integritas pipeline dan mencegah perubahan yang tidak terkontrol.

---

# 24. Success Criteria

Execution Runtime dianggap berhasil apabila:

- seluruh task dijalankan sesuai Execution Plan
- dependency dipatuhi
- retry dan recovery bekerja sesuai konfigurasi
- checkpoint berhasil dibuat
- rollback dapat dilakukan jika diperlukan
- seluruh event dipublikasikan
- seluruh metrik tercatat
- status akhir workflow dikembalikan ke Orchestrator

---

# 25. Summary

Execution Runtime adalah mesin eksekusi AI Engine Suro & Buya.

Ia menerima Execution Plan dari Orchestrator, menjalankan setiap task sesuai urutan dan dependency, mengelola lifecycle, retry, timeout, recovery, rollback, serta memastikan seluruh proses dapat diamati, diaudit, dan dipulihkan tanpa mengubah logika bisnis maupun isi Universe Bible.