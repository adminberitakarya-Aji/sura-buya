# Generation Pipeline Design

Version: 1.0

---

# Introduction

Generation Pipeline adalah rangkaian proses yang mengubah hasil planning menjadi konten cerita yang dapat digunakan dalam produksi.

Generation Pipeline tidak bekerja secara bebas.

Setiap generasi harus mengikuti:

```text
Universe Bible

↓

Retrieved Context

↓

Approved Plan

↓

Generation Pipeline

↓

Validation

↓

Production Output
```

---

# Generation Philosophy

## Structured Generation

Suro & Buya AI Engine tidak menggunakan pendekatan:

```text
Prompt

↓

Random Story Output
```

Tetapi:

```text
Context

↓

Plan

↓

Generation Stage

↓

Validation

↓

Refinement
```

---

# Generation Purpose

Generation Pipeline bertujuan untuk menghasilkan:

* story structure,
* episode content,
* scene description,
* dialogue,
* production information.

---

# Generation Position

```text
Planning Engine

↓

Generation Pipeline

↓

Validation Engine

↓

Review Runtime

↓

Production Runtime
```

---

# Generation Responsibilities

Generation Pipeline bertanggung jawab terhadap:

## 1. Content Creation

Menghasilkan konten berdasarkan plan.

---

## 2. Context Application

Menggunakan:

* character context,
* world context,
* story context,
* visual context.

---

## 3. Format Compliance

Menghasilkan output sesuai schema.

---

## 4. Creative Consistency

Menjaga:

* personality,
* world rules,
* narrative style.

---

# Generation Architecture

Struktur:

```text
Generation Pipeline

├── Context Preparation
│
├── Story Generator
│
├── Scene Generator
│
├── Dialogue Generator
│
├── Description Generator
│
├── Production Generator
│
└── Output Formatter
```

---

# Context Preparation

## Responsibility

Menyiapkan seluruh informasi sebelum generation.

Input:

```text
Planning Object

+

Retrieved Context

+

Memory State
```

Output:

```text
Generation Context Package
```

---

# Generation Context Package

Struktur:

```yaml
generation_context:

story_context:

character_context:

world_context:

style_context:

production_context:

constraints:
```

---

# Story Generator

## Responsibility

Menghasilkan struktur cerita utama.

Input:

```text
Episode Plan
```

Output:

```text
Story Object
```

Menghasilkan:

* premise,
* narrative flow,
* story beats,
* resolution.

---

# Scene Generator

## Responsibility

Mengubah episode plan menjadi scene detail.

Input:

```text
Scene Plan
```

Output:

```text
Scene Object
```

Setiap scene:

```text
Scene

├── Objective
├── Location
├── Characters
├── Action
├── Emotion
└── Transition
```

---

# Dialogue Generator

## Responsibility

Menghasilkan percakapan karakter.

Input:

```text
Scene Context

+

Character Profile
```

Output:

```text
Dialogue Object
```

Memastikan:

* karakter berbicara sesuai personality,
* bahasa sesuai target audience,
* tidak keluar dari canon.

---

# Description Generator

## Responsibility

Menghasilkan deskripsi pendukung.

Contoh:

* environment description,
* action description,
* visual direction.

---

# Production Generator

## Responsibility

Menghasilkan kebutuhan produksi.

Output:

```text
Production Package
```

Isi:

* asset requirement,
* storyboard information,
* voice requirement.

---

# Output Formatter

## Responsibility

Mengubah hasil generation menjadi format resmi.

Contoh:

```text
Generated Content

↓

Schema Validation

↓

Approved Object Format
```

---

# Generation Flow

Contoh pembuatan episode:

```text
Episode Plan

↓

Context Preparation

↓

Story Generation

↓

Scene Generation

↓

Dialogue Generation

↓

Production Information

↓

Output Formatting

↓

Validation
```

---

# Generation Stages

## Stage 1 — Story Generation

Tujuan:

Membuat struktur episode.

Input:

```text
Episode Plan
```

Output:

```text
Story Object
```

---

## Stage 2 — Scene Generation

Tujuan:

Membuat detail visual dan aksi.

Input:

```text
Story Object
```

Output:

```text
Scene Objects
```

---

## Stage 3 — Dialogue Generation

Tujuan:

Membuat interaksi karakter.

Input:

```text
Scene Objects
```

Output:

```text
Dialogue Objects
```

---

## Stage 4 — Production Generation

Tujuan:

Menyiapkan kebutuhan produksi.

Input:

```text
Validated Story
```

Output:

```text
Production Package
```

---

# Generation Object Model

Output mengikuti schema:

```text
Story Schema

↓

Scene Schema

↓

Dialogue Schema

↓

Production Schema
```

---

# Prompt Execution Layer

Generation menggunakan prompt terstruktur.

Flow:

```text
Generation Request

↓

Prompt Template

↓

Context Injection

↓

Model Execution

↓

Output Parsing
```

---

# Prompt Sources

Prompt berasal dari:

```text
templates/prompt/

├── generation.prompt.md
├── planning.prompt.md
├── validation.prompt.md
└── production.prompt.md
```

---

# Generation Constraints

Setiap generation harus memiliki:

## Canon Constraint

```text
Follow Universe Bible
```

---

## Character Constraint

```text
Follow Character Bible
```

---

## World Constraint

```text
Follow World Bible
```

---

## Style Constraint

```text
Follow Visual Bible
```

---

# Generation State

Lifecycle:

```text
Requested

↓

Preparing Context

↓

Generating

↓

Formatting

↓

Validation Pending

↓

Completed
```

---

# Generation Memory Usage

Generation membaca:

* previous episode state,
* character progression,
* unresolved story thread.

Namun:

Generation tidak langsung menulis memory.

Flow:

```text
Generation Output

↓

Validation

↓

Memory Update
```

---

# Generation Error Handling

## Context Missing

```text
Missing Context

↓

Stop Generation

↓

Request Retrieval
```

---

## Invalid Output

```text
Generation Complete

↓

Schema Failure

↓

Regenerate
```

---

## Canon Conflict

```text
Generated Content

↓

Canon Check Failed

↓

Revision
```

---

# Regeneration Strategy

Regeneration tidak selalu membuat ulang seluruh output.

Level:

```text
Full Regeneration

↓

Section Regeneration

↓

Scene Regeneration

↓

Dialogue Regeneration
```

---

# Quality Control Integration

Generation terhubung dengan:

```text
Generation

↓

Validation Runtime

↓

Review Runtime
```

---

# Performance Strategy

Optimasi:

* context caching,
* staged generation,
* parallel scene generation,
* reusable patterns.

---

# Scalability Model

Tahapan:

## Level 1

Single Generation Worker

```text
One Episode

↓

One Pipeline
```

---

## Level 2

Parallel Generation

```text
Multiple Scenes

↓

Multiple Workers
```

---

## Level 3

Distributed Production Generation

```text
Season Production

↓

Multiple Pipelines
```

---

# Security Rules

Generation:

1. Tidak membuat canon baru.

2. Tidak melewati validation.

3. Menggunakan prompt version resmi.

4. Menggunakan context approved.

5. Menghasilkan output yang dapat diaudit.

---

# Future Enhancement

Generation Pipeline dapat dikembangkan dengan:

* adaptive storytelling,
* multi-agent generation,
* style consistency model,
* automated creative refinement.

---

# Relationship With Documentation

```text
07-engine-spec/generation-runtime.md

↓

08-implementation-design/generation-pipeline-design.md

↓

Generation Implementation
```

---

# Conclusion

Generation Pipeline adalah mesin kreatif Suro & Buya AI Engine.

Arsitektur:

```text
Creator Intent

↓

Planning

↓

Generation Pipeline

↓

Validation

↓

Production Ready Story
```

Dengan pipeline ini, AI menghasilkan cerita secara:

* terstruktur,
* konsisten,
* dapat divalidasi,
* siap diproduksi.
