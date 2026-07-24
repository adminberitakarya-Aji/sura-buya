# Backend Architecture

Version: 1.0

---

# Introduction

Backend Architecture mendefinisikan struktur teknis backend untuk **Suro & Buya AI Engine**.

Backend bertugas menjadi fondasi operasional yang menghubungkan:

* creator workflow,
* AI Engine runtime,
* knowledge system,
* data management,
* production pipeline.

Backend bukan sekadar API server.

Backend adalah sistem koordinasi yang menjalankan seluruh lifecycle pembuatan serial.

Arsitektur:

```text
Creator Request

↓

Backend System

↓

AI Engine Processing

↓

Validated Output

↓

Production Package
```

---

# Backend Architecture Goals

## 1. Modular System

Backend harus memiliki batas modul yang jelas.

Setiap komponen memiliki:

* tanggung jawab,
* interface,
* lifecycle.

---

## 2. Engine Orchestration

Backend harus mampu mengatur:

* workflow execution,
* AI module execution,
* state management.

---

## 3. Data Consistency

Backend harus menjaga:

* Universe Bible reference,
* story state,
* production state.

---

## 4. Extensibility

Backend harus dapat berkembang untuk:

* model AI baru,
* workflow baru,
* production integration.

---

# Backend Position

Backend berada di antara interface pengguna dan engine core.

```text
                Creator

                   ↓

              API Gateway

                   ↓

             Backend Services

                   ↓

             AI Engine Core

                   ↓

          Knowledge & Storage
```

---

# Backend Layer Architecture

Struktur backend:

```text
Backend System

├── API Layer
│
├── Application Layer
│
├── Domain Layer
│
├── Engine Integration Layer
│
├── Data Access Layer
│
└── Infrastructure Layer
```

---

# API Layer

## Responsibility

Menerima request dari client.

Tanggung jawab:

* authentication,
* request validation,
* response formatting.

Contoh endpoint:

```text
POST /episodes

GET /characters

POST /generation/request

POST /review
```

---

# Application Layer

## Responsibility

Mengatur use case sistem.

Contoh:

```text
Create Character

Create Episode

Generate Story

Validate Output

Prepare Production
```

Application layer mengatur alur bisnis tanpa mengetahui detail implementasi engine.

---

# Domain Layer

## Responsibility

Berisi konsep utama Suro & Buya AI Engine.

Domain object:

```text
Character

World

Story

Season

Episode

Scene

Dialogue

Review

Production
```

---

# Domain Rule

Domain layer memastikan:

* object memiliki struktur benar,
* relationship konsisten,
* lifecycle berjalan sesuai aturan.

---

# Engine Integration Layer

## Responsibility

Menghubungkan backend dengan AI Engine.

Komponen:

```text
Engine Adapter

Workflow Executor

Runtime Connector

Prompt Manager
```

---

# Engine Adapter

Menghubungkan backend dengan:

```text
Orchestrator

↓

Planning Engine

↓

Generation Engine

↓

Validation Engine
```

---

# Workflow Executor

## Responsibility

Menjalankan workflow.

Contoh:

```text
Episode Creation Workflow

↓

Planning

↓

Generation

↓

Validation

↓

Review
```

---

# Prompt Manager

## Responsibility

Mengelola prompt template.

Sumber:

```text
templates/prompt/
```

Mengatur:

* prompt version,
* context injection,
* execution rules.

---

# Data Access Layer

## Responsibility

Mengatur komunikasi dengan storage.

Tidak ada business logic di layer ini.

Komponen:

```text
Repository

Query Service

Data Mapper
```

---

# Infrastructure Layer

## Responsibility

Menyediakan kebutuhan teknis.

Contoh:

```text
Database Connection

File Storage

Queue

Cache

External Service
```

---

# Backend Service Boundary

Backend dibagi berdasarkan domain.

```text
Backend Services

├── Project Service
│
├── Universe Service
│
├── Story Service
│
├── Episode Service
│
├── Engine Service
│
├── Review Service
│
└── Production Service
```

---

# Project Service

Mengelola:

* project,
* series,
* workspace.

---

# Universe Service

Mengelola akses:

```text
Character Bible

World Bible

Story Bible

Visual Bible

Production Bible
```

---

# Story Service

Mengelola:

* story object,
* season,
* episode,
* scene.

---

# Episode Service

Mengelola lifecycle episode.

State:

```text
Draft

↓

Generated

↓

Validated

↓

Reviewed

↓

Produced
```

---

# Engine Service

Menjadi interface ke AI Engine.

Tugas:

* request generation,
* tracking execution,
* managing result.

---

# Review Service

Mengelola:

* review request,
* feedback,
* approval.

---

# Production Service

Mengelola:

* production package,
* asset requirement,
* production state.

---

# Backend Request Flow

Contoh:

Creator membuat episode.

```text
Create Episode Request

↓

API Layer

↓

Episode Service

↓

Engine Service

↓

Orchestrator

↓

Planning Runtime

↓

Generation Runtime

↓

Validation Runtime

↓

Episode Result
```

---

# Backend Event Flow

Backend menggunakan event untuk proses asynchronous.

Contoh:

```text
EpisodeCreated

↓

GenerationRequested

↓

GenerationCompleted

↓

ValidationCompleted

↓

ProductionPrepared
```

---

# Backend State Management

Setiap object memiliki lifecycle.

Contoh Episode:

```text
Created

↓

Planning

↓

Generating

↓

Validating

↓

Reviewing

↓

Approved

↓

Production
```

---

# Backend Data Ownership

Setiap service memiliki ownership.

Contoh:

| Service            | Ownership       |
| ------------------ | --------------- |
| Universe Service   | Canon Data      |
| Story Service      | Narrative Data  |
| Engine Service     | Execution Data  |
| Review Service     | Review Data     |
| Production Service | Production Data |

---

# Backend Communication Pattern

Komunikasi internal:

```text
Synchronous:

API Request
↓

Service Response
```

dan:

```text
Asynchronous:

Event

↓

Queue

↓

Worker
```

---

# Backend Integration With AI Runtime

```text
Backend

↓

Engine Service

↓

Orchestrator

↓

AI Runtime Modules
```

Backend tidak langsung memanggil model AI.

Semua melalui Orchestrator.

---

# Backend Integration With Storage

```text
Application Layer

↓

Repository Layer

↓

Storage
```

Storage:

* relational database,
* document storage,
* object storage.

---

# Error Handling

Backend menangani:

## Validation Error

```text
Invalid Request

↓

Return Error Response
```

---

## Engine Failure

```text
Runtime Error

↓

Retry

↓

Log

↓

Notify
```

---

## Data Conflict

```text
Version Conflict

↓

Reject Update

↓

Require Review
```

---

# Security Boundary

Backend harus melindungi:

* authentication,
* authorization,
* Universe Bible,
* production asset,
* generated content.

Detail:

```text
security-architecture.md
```

---

# Scalability Strategy

## Phase 1

Modular Monolith.

Tujuan:

* cepat dikembangkan,
* mudah dipelihara.

---

## Phase 2

Service Separation.

Memisahkan:

* engine processing,
* storage,
* production.

---

## Phase 3

Distributed Architecture.

Mendukung:

* multiple workers,
* large scale generation,
* parallel production.

---

# Technology Independence

Dokumen ini tidak mengunci teknologi tertentu.

Backend dapat diimplementasikan menggunakan berbagai stack selama memenuhi:

* modularity,
* scalability,
* reliability.

---

# Relationship With Other Documents

```text
09-implementation-architecture/

system-architecture.md

↓

backend-architecture.md

↓

service-boundary.md

↓

database-architecture.md
```

---

# Conclusion

Backend Architecture menjadi fondasi operasional Suro & Buya AI Engine.

Struktur:

```text
API

↓

Backend Services

↓

Engine Integration

↓

AI Runtime

↓

Knowledge System

↓

Production System
```

Dengan backend architecture ini, seluruh proses kreatif dapat berjalan sebagai sistem software yang terstruktur, dapat dikembangkan, dan siap menuju implementasi engineering.
