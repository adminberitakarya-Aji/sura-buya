# Queue & Event Architecture

Version: 1.0

---

# Introduction

Queue & Event Architecture mendefinisikan mekanisme komunikasi asynchronous dalam **Suro & Buya AI Engine**.

AI Engine memiliki proses yang membutuhkan waktu dan resource besar seperti:

* story generation,
* scene generation,
* dialogue processing,
* validation,
* asset preparation,
* production automation.

Tidak semua proses dapat dijalankan secara synchronous.

Karena itu engine menggunakan konsep:

```text
Request

↓

Queue

↓

Worker Processing

↓

Event Notification

↓

Next Workflow
```

---

# Queue & Event Philosophy

## Asynchronous by Design

Proses berat harus berjalan secara asynchronous.

Contoh:

```
Episode Generation Request

↓

Generation Queue

↓

AI Worker

↓

Generated Episode
```

Creator tidak harus menunggu proses selesai secara langsung.

---

## Event Driven Workflow

Komponen engine berkomunikasi melalui event.

Contoh:

```
Planning Completed

↓

Generation Started

↓

Validation Required
```

---

# Queue & Event Position

Queue dan Event Layer berada di antara service communication dan execution layer.

```text
Application

↓

API Gateway

↓

Service Layer

↓

Queue & Event System

↓

Worker

↓

AI Runtime
```

---

# Architecture Overview

```text
                    Event Bus

                       │

     ┌─────────────────┼─────────────────┐

     ↓                 ↓                 ↓

 Planning Queue   Generation Queue   Validation Queue


     ↓                 ↓                 ↓


 Planning Worker  Generation Worker Validation Worker


                       ↓

                AI Runtime
```

---

# Queue Architecture

## Queue Purpose

Queue digunakan untuk:

* menyimpan pekerjaan,
* mengatur prioritas,
* mendistribusikan workload,
* menangani retry.

---

# Queue Types

Struktur:

```
queues/

├── planning
├── generation
├── validation
├── review
├── production
└── asset-processing
```

---

# Planning Queue

## Responsibility

Menangani proses:

* story planning,
* season planning,
* episode planning.

Input:

```
Creator Intent
```

Output:

```
Planning Object
```

---

# Generation Queue

## Responsibility

Menangani:

* story generation,
* scene generation,
* dialogue generation.

Input:

```
Planning Result
```

Output:

```
Creative Object
```

---

# Validation Queue

## Responsibility

Menangani:

* canon validation,
* schema validation,
* quality validation.

Input:

```
Generated Output
```

Output:

```
Validation Result
```

---

# Review Queue

## Responsibility

Menangani:

* review package,
* approval workflow.

Input:

```
Validated Content
```

Output:

```
Review Object
```

---

# Production Queue

## Responsibility

Menangani:

* production preparation,
* asset packaging,
* publishing preparation.

Input:

```
Approved Content
```

Output:

```
Production Package
```

---

# Asset Processing Queue

## Responsibility

Menangani:

* asset registration,
* metadata generation,
* asset validation.

Input:

```
New Asset
```

Output:

```
Asset Record
```

---

# Queue Message Structure

Setiap queue message memiliki format standar.

Contoh:

```json
{
  "message_id": "MSG-001",

  "type": "episode-generation",

  "source": "planning-service",

  "payload": {},

  "created_at": "timestamp"
}
```

---

# Message Properties

## Message ID

Identitas unik message.

---

## Message Type

Menentukan jenis pekerjaan.

Contoh:

```
scene-generation
dialogue-validation
production-package
```

---

## Source

Service pengirim.

---

## Payload

Data yang diproses.

---

## Timestamp

Waktu pembuatan.

---

# Worker Architecture

Worker bertugas mengambil pekerjaan dari queue.

Flow:

```
Queue

↓

Worker

↓

Processing

↓

Result Event
```

---

# Worker Responsibility

Worker:

* mengambil message,
* menjalankan proses,
* menyimpan hasil,
* mengirim event.

---

# Event Architecture

Event digunakan untuk memberi tahu perubahan sistem.

---

# Event Types

Struktur:

```
events/

├── domain-event
├── workflow-event
├── system-event
└── production-event
```

---

# Domain Events

Berhubungan dengan object.

Contoh:

```
CharacterCreated

EpisodeCreated

SceneGenerated
```

---

# Workflow Events

Berhubungan dengan proses.

Contoh:

```
PlanningCompleted

GenerationStarted

ValidationCompleted
```

---

# System Events

Berhubungan dengan sistem.

Contoh:

```
WorkerStarted

WorkerFailed

ServiceUnavailable
```

---

# Production Events

Berhubungan dengan produksi.

Contoh:

```
ProductionReady

AssetApproved

EpisodePublished
```

---

# Event Structure

Contoh:

```json
{
  "event_id": "EVENT-001",

  "event_type":
  "episode.generated",

  "entity_id":
  "EP-001",

  "timestamp":
  "time",

  "data": {}
}
```

---

# Event Flow Example

## Episode Generation

```
Creator Request

↓

Planning Queue

↓

Planning Worker

↓

planning.completed Event

↓

Generation Queue

↓

Generation Worker

↓

generation.completed Event

↓

Validation Queue
```

---

# Event Driven Runtime

AI Runtime menggunakan event untuk:

* melanjutkan workflow,
* memicu proses berikutnya,
* mencatat execution history.

---

# Retry Strategy

Jika worker gagal:

```
Failed Job

↓

Retry Queue

↓

Retry Attempt

↓

Success / Dead Letter Queue
```

---

# Dead Letter Queue

Job yang gagal permanen dipindahkan ke:

```
DLQ
```

Untuk:

* investigasi,
* debugging,
* manual recovery.

---

# Priority System

Queue mendukung prioritas.

Contoh:

```
Priority 1

Production Release


Priority 2

Creator Request


Priority 3

Background Processing
```

---

# Event Ordering

Event penting harus menjaga urutan.

Contoh:

Benar:

```
Episode Planned

↓

Episode Generated

↓

Episode Validated
```

Salah:

```
Episode Validated

↓

Episode Generated
```

---

# Idempotency

Setiap proses harus aman dijalankan ulang.

Contoh:

Jika generation retry:

```
Generation Request ID

↓

Check Existing Result

↓

Continue / Regenerate
```

---

# Queue Monitoring

Sistem harus memonitor:

* queue length,
* processing time,
* failed jobs,
* retry count.

---

# Observability

Setiap message harus dapat dilacak:

```
Message ID

↓

Execution ID

↓

Worker

↓

Result
```

---

# Security

Queue harus melindungi:

* Universe data,
* generated content,
* production information.

Aturan:

```
Message tidak boleh berisi data sensitif tanpa protection.
```

---

# Relationship With Runtime

```
AI Runtime

↓

Queue System

↓

Worker Execution

↓

Event Result
```

---

# Relationship With Service Boundary

```
service-boundary.md

↓

queue-event-architecture.md

↓

service communication
```

---

# Relationship With Deployment

Queue membutuhkan:

* worker deployment,
* monitoring,
* scaling strategy.

Referensi:

```
deployment-architecture.md
```

---

# Scaling Strategy

## Phase 1

Single queue system.

```
Central Queue

+

Multiple Workers
```

---

## Phase 2

Domain queue separation.

```
Generation Queue

Validation Queue

Production Queue
```

---

## Phase 3

Distributed event architecture.

```
Multiple Runtime Cluster

+

Event Streaming
```

---

# Future Extension

Pengembangan:

* real-time event streaming,
* intelligent workload routing,
* automatic recovery,
* distributed AI workers.

---

# Conclusion

Queue & Event Architecture memastikan Suro & Buya AI Engine dapat menjalankan proses kompleks secara stabil.

Model akhir:

```
Creator Intent

↓

Queue

↓

AI Worker

↓

Event

↓

Next Process

↓

Production Output
```

Dengan pendekatan event-driven, engine dapat berkembang dari workflow sederhana menjadi sistem produksi serial AI yang scalable.
