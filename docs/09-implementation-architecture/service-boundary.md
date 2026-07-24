# Service Boundary

Version: 1.0

---

# Introduction

Service Boundary mendefinisikan batas tanggung jawab setiap service dalam **Suro & Buya AI Engine**.

Dokumen ini memastikan setiap komponen sistem memiliki:

* tanggung jawab yang jelas,
* ownership data yang jelas,
* interface komunikasi yang jelas,
* dependency yang terkendali.

Tujuan utama:

```text
Clear Responsibility

↓

Loose Coupling

↓

Maintainable AI Engine
```

---

# Boundary Philosophy

Suro & Buya AI Engine menggunakan prinsip:

## One Service One Responsibility

Setiap service memiliki satu tanggung jawab utama.

Contoh:

```
Universe Service

bertanggung jawab terhadap:

Character Bible
World Bible
Story Bible
```

bukan:

```
Universe Service

+
Story Generation

+
Production Processing
```

---

# Service Boundary Principles

## Principle 1

Service memiliki ownership terhadap data domainnya.

---

## Principle 2

Service lain tidak boleh mengubah data secara langsung.

---

## Principle 3

Komunikasi antar service menggunakan contract.

---

## Principle 4

AI Engine module tidak memiliki akses langsung ke database.

---

## Principle 5

Perubahan satu service tidak boleh merusak service lain.

---

# High Level Service Architecture

```text
                    API Gateway

                         |

        ┌────────────────┼────────────────┐

        ↓                ↓                ↓

 Universe Service   Story Service   Production Service


        ↓                ↓                ↓


        ┌─────────────────────────────────┐

        │          Engine Service          │

        └─────────────────────────────────┘


                         |

                  AI Runtime System


                         |

                  Storage Layer
```

---

# Core Services

Suro & Buya AI Engine memiliki service utama:

```text
services/

├── Project Service

├── Universe Service

├── Story Service

├── Episode Service

├── Engine Service

├── Review Service

├── Production Service

└── Asset Service
```

---

# Project Service Boundary

## Responsibility

Mengelola project serial.

---

## Owns

```
Project

Series

Workspace

Configuration
```

---

## Does Not Own

```
Character

Story Content

Production Asset
```

---

## Provides

```
Project Context

Project Metadata

Project Configuration
```

---

# Universe Service Boundary

## Responsibility

Mengelola seluruh canon knowledge.

---

## Owns

```
Character Bible

World Bible

Story Bible

Visual Bible

Production Bible
```

---

## Rules

Universe Service adalah penjaga canon.

Semua service yang membutuhkan informasi canon harus melalui service ini.

---

## Does Not Own

```
Generated Story

Episode Output

Production Package
```

---

## Provides

```
Canon Retrieval

Reference Context

Bible Validation Data
```

---

# Story Service Boundary

## Responsibility

Mengelola struktur narasi.

---

## Owns

```
Story

Narrative Arc

Theme

Conflict

Resolution
```

---

## Provides

```
Story Context

Narrative Structure

Story Relationship
```

---

## Does Not Own

```
Character Canon

Production Asset
```

---

# Episode Service Boundary

## Responsibility

Mengelola lifecycle episode.

---

## Owns

```
Episode

Scene

Dialogue Reference

Episode Status
```

---

## Lifecycle:

```
Draft

↓

Planning

↓

Generation

↓

Validation

↓

Review

↓

Approved
```

---

## Provides

```
Episode Context

Generation Request

Episode Result
```

---

# Engine Service Boundary

## Responsibility

Menjadi gateway ke AI Engine.

---

## Owns

```
Execution Request

Workflow State

AI Processing Result

Runtime Status
```

---

## Contains

```
Orchestrator Interface

Planning Interface

Generation Interface

Validation Interface
```

---

## Does Not Own

```
Canon Data

Production Asset
```

---

# Review Service Boundary

## Responsibility

Mengelola proses evaluasi.

---

## Owns

```
Review Request

Feedback

Approval Status

Decision History
```

---

## Provides

```
Review Result

Approval State
```

---

# Production Service Boundary

## Responsibility

Mengelola persiapan produksi.

---

## Owns

```
Production Package

Production Status

Production Requirement
```

---

## Provides

```
Production Ready Output

Asset Requirement

Pipeline Information
```

---

# Asset Service Boundary

## Responsibility

Mengelola asset repository.

---

## Owns

```
Asset Metadata

Asset Reference

Asset Version
```

---

## Does Not Own

```
Character Canon

Visual Rules
```

---

## Provides

```
Asset Retrieval

Asset Availability

Asset History
```

---

# Service Dependency Rules

Dependency hierarchy:

```text
                 Project Service

                       ↓

              Universe Service

                       ↓

                Story Service

                       ↓

              Episode Service

                       ↓

               Engine Service

                       ↓

             Production Service
```

---

# Forbidden Dependencies

## Rule 1

Universe Service tidak boleh bergantung kepada Engine Service.

Salah:

```
Universe

↓

AI Generation
```

---

## Rule 2

Production Service tidak membuat cerita.

Salah:

```
Production

↓

Story Creation
```

---

## Rule 3

Engine Service tidak menyimpan canon.

Salah:

```
AI Runtime

↓

Character Database
```

---

# Communication Contract

Service berkomunikasi melalui:

## API Contract

Untuk request-response.

Contoh:

```
GET /characters/{id}
```

---

## Event Contract

Untuk proses asynchronous.

Contoh:

```
EpisodeGenerated

ValidationCompleted

ProductionReady
```

---

# Data Ownership Model

```text
Service

↓

Own Data

↓

Expose Contract

↓

Other Service Consume
```

Tidak ada shared database access langsung.

---

# Service State Management

Setiap service mengelola lifecycle sendiri.

Contoh:

Episode Service:

```
Draft

↓

Generated

↓

Validated

↓

Approved
```

Production Service:

```
Prepared

↓

Production

↓

Released
```

---

# AI Engine Isolation

AI Engine dipisahkan dari business service.

Arsitektur:

```text
Business Layer

↓

Engine Service

↓

AI Runtime

↓

Model Provider
```

Keuntungan:

* mudah mengganti model,
* mudah testing,
* menjaga domain tetap bersih.

---

# Future Microservice Migration

Awal implementasi dapat menggunakan:

```
Modular Backend
```

Kemudian berkembang menjadi:

```
Independent Services
```

tanpa mengubah boundary.

---

# Relationship With Other Documents

```text
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

Service Boundary memastikan Suro & Buya AI Engine tetap modular dan dapat berkembang.

Model akhir:

```text
Clear Ownership

↓

Controlled Communication

↓

Independent Evolution

↓

Scalable AI Engine
```

Dengan boundary yang jelas, engine dapat berkembang tanpa kehilangan konsistensi antara:

```
Universe Bible

AI Reasoning

Story Generation

Production Pipeline
```
