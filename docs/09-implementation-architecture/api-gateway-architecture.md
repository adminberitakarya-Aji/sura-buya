# API Gateway Architecture

Version: 1.0

---

# Introduction

API Gateway Architecture mendefinisikan lapisan masuk utama komunikasi antara client, creator tools, production system, dan internal service pada **Suro & Buya AI Engine**.

API Gateway bukan tempat menjalankan business logic utama.

Perannya adalah sebagai:

* single entry point,
* request routing,
* authentication boundary,
* request validation,
* traffic management,
* API orchestration.

Arsitektur:

```text
Client

↓

API Gateway

↓

Backend Services

↓

AI Engine
```

---

# API Gateway Philosophy

## Gateway as Controlled Entry Point

Seluruh komunikasi eksternal harus melewati API Gateway.

Tidak diperbolehkan:

```text
Client

↓

Internal Service
```

Karena dapat menyebabkan:

* keamanan lemah,
* service coupling,
* sulit monitoring.

---

## Gateway Does Not Own Domain Logic

API Gateway tidak bertanggung jawab terhadap:

* story generation,
* canon validation,
* production decision.

Domain logic tetap berada pada service masing-masing.

---

# API Gateway Position

```text
                Creator Interface

                       ↓

                 API Gateway

                       ↓

 ┌───────────────┬───────────────┬───────────────┐

 Character      Story           Engine          Production
 Service        Service         Service         Service

                       ↓

                 AI Runtime
```

---

# API Gateway Responsibilities

API Gateway menangani:

```
Request Management

Authentication

Authorization

Routing

Validation

Rate Limiting

Logging

Monitoring
```

---

# Request Flow

```text
User Request

↓

API Gateway

↓

Authentication Check

↓

Request Validation

↓

Service Routing

↓

Service Response

↓

Client Response
```

---

# Service Routing

API Gateway mengarahkan request berdasarkan domain.

Contoh:

```text
/api/v1/characters

↓

Character Service
```

---

```text
/api/v1/episodes

↓

Episode Service
```

---

```text
/api/v1/generate

↓

AI Engine Service
```

---

# API Namespace Structure

Standar:

```
/api/{version}/{domain}/{resource}
```

Contoh:

```
/api/v1/story/episodes
```

---

# API Domain Mapping

| Domain     | Service            |
| ---------- | ------------------ |
| Character  | Character Service  |
| World      | World Service      |
| Story      | Story Service      |
| Episode    | Episode Service    |
| Dialogue   | Dialogue Service   |
| Review     | Review Service     |
| Production | Production Service |
| Engine     | AI Engine Service  |

---

# Authentication Layer

API Gateway melakukan pemeriksaan identitas.

Flow:

```text
Request

↓

Authentication

↓

Token Validation

↓

Continue
```

---

# Authentication Responsibility

Gateway memeriksa:

* token validity,
* session,
* API key,
* expiration.

---

# Authorization Layer

Setelah identitas diketahui:

Gateway memeriksa permission.

Contoh:

```text
Creator

boleh:

Create Story


tidak boleh:

Modify Canon Bible
```

---

# Role Model

Contoh:

```
User

↓

Creator

↓

Reviewer

↓

Producer

↓

Administrator
```

---

# Request Validation

Sebelum diteruskan:

Gateway melakukan:

* schema validation,
* required field check,
* format validation.

Contoh:

```json
{
 "episode_id": "EP-001"
}
```

harus sesuai:

```
episode.schema.json
```

---

# Response Management

Gateway menyeragamkan response.

Format:

```json
{
 "success": true,

 "data": {},

 "metadata": {}
}
```

---

# Error Response

Format:

```json
{
 "success": false,

 "error": {
   "code": "INVALID_REQUEST",
   "message": "Invalid data"
 }
}
```

---

# Rate Limiting

Tujuan:

* mencegah abuse,
* menjaga resource AI.

Contoh:

```
Normal Request

↓

Limited


AI Generation Request

↓

Higher Control
```

---

# AI Generation Protection

Proses AI membutuhkan resource besar.

Gateway dapat menerapkan:

```
Generation Request

↓

Quota Check

↓

Queue Submission

↓

Processing
```

---

# Request Logging

Setiap request dicatat.

Data:

```
Request ID

User ID

Endpoint

Timestamp

Response Status
```

---

# Request Tracing

Setiap request memiliki:

```
Request ID

↓

Service Call

↓

Execution ID

↓

Result
```

---

# Integration With AI Engine

Flow:

```
Creator

↓

API Gateway

↓

Engine Service

↓

AI Runtime

↓

Generation Pipeline

↓

Result
```

---

# Integration With Queue System

Untuk proses panjang:

```
API Request

↓

API Gateway

↓

Create Job

↓

Queue

↓

Worker

↓

Event

↓

Result
```

---

# Synchronous vs Asynchronous API

## Synchronous

Digunakan untuk:

* read data,
* simple update.

Contoh:

```
GET /characters/{id}
```

---

## Asynchronous

Digunakan untuk:

* generation,
* validation,
* production process.

Contoh:

```
POST /episodes/generate
```

Response:

```json
{
 "job_id":
 "JOB-001",

 "status":
 "queued"
}
```

---

# API Versioning

Gateway mendukung versioning:

```
/api/v1/

↓

/api/v2/
```

Perubahan besar tidak merusak client lama.

---

# Security Boundary

API Gateway menjadi lapisan pertama keamanan.

Melindungi:

* Universe Bible,
* unpublished stories,
* production assets,
* AI execution data.

---

# Internal Service Communication

Service internal dapat menggunakan:

```
Internal API

atau

Event Communication
```

Gateway tidak digunakan untuk seluruh komunikasi internal.

---

# Gateway Scaling

## Phase 1

Single API Gateway.

```
Client

↓

Gateway

↓

Services
```

---

## Phase 2

Horizontal Scaling.

```
Load Balancer

↓

Multiple Gateway Instance
```

---

## Phase 3

Advanced Routing.

```
API Gateway

+

Service Mesh

+

Traffic Management
```

---

# Failure Handling

## Service Unavailable

Response:

```
503 SERVICE_UNAVAILABLE
```

---

## Invalid Request

Response:

```
400 BAD_REQUEST
```

---

## Unauthorized

Response:

```
401 UNAUTHORIZED
```

---

## Forbidden

Response:

```
403 FORBIDDEN
```

---

# Relationship With Other Architecture

```
service-boundary.md

↓

api-gateway-architecture.md

↓

queue-event-architecture.md

↓

deployment-architecture.md
```

---

# Relationship With API Documentation

Implementasi endpoint:

```
docs/06-api/
```

Gateway hanya mengatur akses.

Detail endpoint tetap berada pada API Documentation.

---

# Future Extension

API Gateway dapat dikembangkan dengan:

* GraphQL gateway,
* API composition,
* intelligent routing,
* realtime streaming,
* external creator API.

---

# Conclusion

API Gateway Architecture menjadi pintu masuk resmi seluruh komunikasi Suro & Buya AI Engine.

Model akhir:

```
Creator

↓

API Gateway

↓

Domain Services

↓

AI Runtime

↓

Production System
```

Dengan API Gateway, engine memiliki komunikasi yang:

* aman,
* terstruktur,
* scalable,
* mudah dikembangkan.
