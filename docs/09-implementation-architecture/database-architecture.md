# Database Architecture

Version: 1.0

---

# Introduction

Database Architecture mendefinisikan rancangan penyimpanan data untuk **Suro & Buya AI Engine**.

Database bukan hanya tempat menyimpan data aplikasi.

Dalam sistem ini database berfungsi sebagai:

* penyimpan domain object,
* penjaga state workflow,
* penyimpan metadata Universe Bible,
* penyimpan execution history,
* penyimpan production information.

Tujuan utama:

```text
Structured Data

↓

Consistent Knowledge

↓

Reliable AI Processing

↓

Production Ready Output
```

---

# Database Architecture Goals

## 1. Data Consistency

Database harus menjaga konsistensi antara:

* character,
* world,
* story,
* episode,
* production.

---

## 2. Traceability

Setiap output harus dapat dilacak:

```text
Generated Content

↓

Workflow Execution

↓

Input Context

↓

Universe Reference
```

---

## 3. Version Control

Semua perubahan penting harus memiliki:

* version,
* timestamp,
* history.

---

## 4. Domain Separation

Data harus mengikuti service boundary.

Contoh:

```text
Universe Data

≠

Production Data
```

---

# Database Position

Database berada pada data layer.

```text
Application Layer

↓

Repository Layer

↓

Database Layer

↓

Storage Infrastructure
```

---

# Data Architecture Overview

```text
                    Application

                         ↓

                  Repository Layer

                         ↓


        ┌────────────────────────────────┐
        │                                │
        │          Database System        │
        │                                │
        │  Domain Data                   │
        │  Workflow Data                 │
        │  Execution Data                │
        │  Knowledge Data                │
        │  Production Data               │
        │                                │
        └────────────────────────────────┘


                         ↓

                  Storage System
```

---

# Database Domains

Database dibagi berdasarkan domain.

```text
database/

├── identity
│
├── project
│
├── universe
│
├── story
│
├── engine
│
├── review
│
├── production
│
└── asset
```

---

# Identity Data

## Responsibility

Menyimpan identitas pengguna sistem.

Data:

```text
User

Role

Permission

Session
```

---

# Project Data

## Responsibility

Menyimpan informasi project Suro & Buya.

Entities:

```text
Project

Series

Workspace

Configuration
```

---

# Universe Data

## Responsibility

Menyimpan referensi Universe Bible.

Entities:

```text
Character

World

Story Rule

Visual Rule

Production Rule
```

---

# Universe Data Rule

Database tidak menggantikan Universe Bible.

Hubungan:

```text
Universe Bible Files

↓

Knowledge Database

↓

Retrieval System

↓

AI Context
```

---

# Story Data

## Responsibility

Menyimpan struktur cerita.

Entities:

```text
Story

Season

Episode

Scene

Dialogue
```

---

# Story Relationship

```text
Series

↓

Season

↓

Episode

↓

Scene

↓

Dialogue
```

---

# Engine Data

## Responsibility

Menyimpan proses AI Engine.

Entities:

```text
Execution

Workflow

Plan

Generation Result

Validation Result
```

---

# Engine Execution Record

Contoh:

```json
{
  "execution_id":
  "EXEC-001",

  "workflow":
  "episode-generation",

  "status":
  "completed"
}
```

---

# Review Data

## Responsibility

Menyimpan proses evaluasi.

Entities:

```text
Review

Feedback

Approval

Decision History
```

---

# Production Data

## Responsibility

Menyimpan informasi produksi.

Entities:

```text
Production Package

Production Task

Production Status

Release Information
```

---

# Asset Data

## Responsibility

Menyimpan metadata asset.

Entities:

```text
Asset

Asset Version

Asset Reference

Asset Usage
```

---

# Core Entity Relationship

```text
Project

↓

Universe

↓

Story

↓

Episode

↓

Production


Engine Execution

↓

Generated Result

↓

Validation

↓

Review
```

---

# Database Model Strategy

Suro & Buya AI Engine menggunakan pendekatan:

## Domain Driven Data Model

Setiap domain memiliki:

* entity,
* relationship,
* lifecycle.

---

# Object Storage Relationship

Tidak semua data disimpan dalam database.

Pembagian:

```text
Database

↓

Structured Data


Object Storage

↓

Files

Images

Audio

Video

Documents
```

---

# Database vs Asset Storage

Database menyimpan:

```text
Asset Metadata

Asset Location

Asset Version
```

Asset Storage menyimpan:

```text
Image

Audio

Video

Reference File
```

---

# Version Management

Entity penting memiliki version.

Contoh:

```text
Character

v1.0

↓

v1.1

↓

v2.0
```

---

# Version Data Model

Contoh:

```json
{
 "entity_id":
 "CHAR-SURO",

 "version":
 "1.0",

 "status":
 "approved"
}
```

---

# Audit Trail

Setiap perubahan penting dicatat.

Informasi:

```text
Changed Object

Previous Version

New Version

Changed By

Timestamp
```

---

# Workflow State Storage

Database menyimpan lifecycle object.

Contoh:

Episode:

```text
draft

↓

planning

↓

generated

↓

validated

↓

approved

↓

production
```

---

# AI Context Storage

Database menyimpan informasi pendukung retrieval.

Contoh:

```text
Character Relationship

Story Timeline

Previous Episode State

Production History
```

---

# Query Pattern

Database harus mendukung:

## Direct Lookup

Contoh:

```text
Get Character By ID
```

---

## Relationship Query

Contoh:

```text
Find Character Appearing In Episode
```

---

## Timeline Query

Contoh:

```text
Get Previous Story Events
```

---

## Retrieval Query

Contoh:

```text
Find Relevant Universe Context
```

---

# Database Access Rules

## Rule 1

Service hanya mengakses data miliknya.

---

## Rule 2

Tidak ada direct database sharing antar service.

---

## Rule 3

Semua perubahan melalui service layer.

---

## Rule 4

Canon data tidak boleh berubah tanpa approval.

---

# Backup Strategy

Data penting:

```text
Universe Data

Story Data

Production Data

Execution History
```

harus memiliki:

* backup,
* recovery,
* version history.

---

# Scalability Strategy

## Phase 1

Single database dengan domain separation.

---

## Phase 2

Database optimization:

* indexing,
* caching,
* query optimization.

---

## Phase 3

Domain database separation.

Contoh:

```text
Universe Database

Story Database

Production Database
```

---

# Security Consideration

Database harus melindungi:

* Universe Bible,
* unpublished story,
* production material.

Detail:

```text
security-architecture.md
```

---

# Relationship With Other Documents

```text
service-boundary.md

↓

database-architecture.md

↓

storage-architecture.md
```

---

# Conclusion

Database Architecture menjadi fondasi penyimpanan seluruh informasi Suro & Buya AI Engine.

Model akhir:

```text
Universe Knowledge

↓

Domain Data

↓

AI Processing History

↓

Production Data

↓

Serialized Content
```

Database memastikan seluruh proses dapat:

* dilacak,
* divalidasi,
* dikembangkan,
* diproduksi secara konsisten.
