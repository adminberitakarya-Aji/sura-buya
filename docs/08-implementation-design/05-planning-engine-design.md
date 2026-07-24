# Planning Engine Design

Version: 1.0

---

# Introduction

Planning Engine adalah komponen yang bertugas mengubah tujuan kreatif creator menjadi rencana cerita yang terstruktur.

Planning Engine tidak menghasilkan cerita final.

Tugas utamanya:

```text
Creator Intent

↓

Story Planning

↓

Execution Plan

↓

Generation Pipeline
```

Planning Engine memastikan AI tidak langsung menulis cerita tanpa struktur.

---

# Planning Philosophy

## Planning Before Generation

Suro & Buya AI Engine menggunakan prinsip:

```
Understand

↓

Plan

↓

Generate

↓

Validate
```

Bukan:

```
Prompt

↓

Generate Random Output
```

---

## Planning is Structural Intelligence

Planning Engine memahami:

* tujuan episode,
* struktur narasi,
* hubungan karakter,
* perkembangan cerita,
* kebutuhan produksi.

---

# Planning is Not Canon

Planning bukan sumber cerita resmi.

Urutan otoritas:

```
Universe Bible

↓

Schema Definition

↓

Approved Story Rules

↓

Planning Output

↓

Generated Content
```

Planning hanya membuat rencana berdasarkan sumber resmi.

---

# Planning Purpose

Planning Engine digunakan untuk:

## 1. Intent Decomposition

Memecah request creator.

Contoh:

Input:

```
Buat episode tentang Suro dan Buya menemukan tempat baru
```

Menjadi:

```
Theme

↓

Story Goal

↓

Conflict

↓

Character Role

↓

Scene Requirement
```

---

## 2. Story Structure Generation

Membuat struktur:

* beginning,
* middle,
* ending,
* narrative beat.

---

## 3. Episode Planning

Menghasilkan:

* episode objective,
* scene list,
* dialogue direction.

---

## 4. Production Planning

Mempersiapkan:

* asset requirement,
* visual need,
* voice requirement.

---

# Planning Engine Position

```
Creator Intent

↓

Orchestrator

↓

Planning Engine

↓

Generation Pipeline
```

---

# Planning Engine Components

Struktur:

```
Planning Engine

├── Intent Analyzer
│
├── Story Planner
│
├── Character Planner
│
├── World Planner
│
├── Episode Planner
│
├── Scene Planner
│
├── Production Planner
│
└── Plan Validator
```

---

# Intent Analyzer

## Responsibility

Memahami tujuan creator.

Input:

```
Creator Request
```

Output:

```
Planning Intent
```

Contoh:

```json
{
 "type": "episode_creation",
 "theme": "adventure",
 "target": "children"
}
```

---

# Story Planner

## Responsibility

Membuat arah cerita.

Menghasilkan:

* premise,
* theme,
* conflict,
* resolution direction.

Contoh:

```
Theme:

Friendship and exploration

Conflict:

Finding lost location

Resolution:

Learning cooperation
```

---

# Character Planner

## Responsibility

Menentukan penggunaan karakter.

Mempertimbangkan:

* personality,
* relationship,
* capability,
* limitation.

Contoh:

```
Suro

Role:
Explorer

Behavior:
Curious

Challenge:
Needs teamwork
```

---

# World Planner

## Responsibility

Menentukan penggunaan dunia.

Mempertimbangkan:

* location,
* rules,
* environment,
* culture.

---

# Episode Planner

## Responsibility

Membuat struktur episode.

Output:

```
Episode Plan

├── Objective
├── Story Arc
├── Scene List
├── Character Involvement
└── Production Need
```

---

# Scene Planner

## Responsibility

Memecah episode menjadi scene.

Contoh:

```
Episode

↓

Scene 1

↓

Scene 2

↓

Scene 3
```

Setiap scene memiliki:

```
Goal

Location

Characters

Action

Emotion
```

---

# Production Planner

## Responsibility

Mengubah kebutuhan cerita menjadi kebutuhan produksi.

Contoh:

Story:

```
Suro masuk hutan misterius
```

Production:

```
Environment Asset

Character Pose

Sound Requirement
```

---

# Plan Validator

## Responsibility

Memeriksa:

* schema validity,
* canon compatibility,
* completeness.

---

# Planning Flow

Contoh:

```
Creator Request

↓

Intent Analysis

↓

Retrieve Context

↓

Story Planning

↓

Episode Planning

↓

Scene Planning

↓

Plan Validation

↓

Generation Runtime
```

---

# Planning Object

Output utama:

```json
{
 "plan_id": "PLAN-SB-001",

 "type": "episode",

 "objective": "",

 "story_structure": {},

 "scene_plan": [],

 "requirements": {}
}
```

---

# Planning Layers

Planning dilakukan bertingkat:

```
Universe Planning

↓

Season Planning

↓

Episode Planning

↓

Scene Planning

↓

Dialogue Planning
```

---

# Universe Planning

Digunakan untuk:

* long-term direction,
* world expansion,
* narrative boundary.

---

# Season Planning

Mengatur:

* season arc,
* episode relationship,
* progression.

---

# Episode Planning

Mengatur:

* satu episode,
* conflict,
* resolution.

---

# Scene Planning

Mengatur:

* scene objective,
* action,
* transition.

---

# Dialogue Planning

Mengatur:

* conversation purpose,
* emotional direction,
* character interaction.

---

# Planning Dependency

Planning membutuhkan:

```
Retrieval System

↓

Universe Context

↓

Planning Engine

↓

Generation
```

---

# Context Requirement

Planning membutuhkan:

## Character Context

```
Who is involved?
```

---

## World Context

```
Where does it happen?
```

---

## Story Context

```
Why does it matter?
```

---

## Production Context

```
How will it be produced?
```

---

# Planning Rules

## Rule 1

Tidak membuat canon baru.

---

## Rule 2

Harus menggunakan context hasil retrieval.

---

## Rule 3

Harus menghasilkan struktur sebelum generation.

---

## Rule 4

Semua plan harus tervalidasi.

---

## Rule 5

Plan harus memiliki version.

---

# Planning Versioning

Setiap plan memiliki:

```
plan_id

version

created_at

source_context

status
```

Contoh:

```json
{
 "plan_id":
 "EP-001",

 "version":
 "1.0",

 "status":
 "approved"
}
```

---

# Planning State

Lifecycle:

```
Draft

↓

Review

↓

Approved

↓

Generated

↓

Archived
```

---

# Planning Error Handling

## Insufficient Context

```
Missing Information

↓

Request Retrieval

↓

Continue Planning
```

---

## Invalid Direction

```
Plan Conflict

↓

Validation

↓

Revision
```

---

## Canon Violation

```
Canon Conflict

↓

Reject Plan
```

---

# Planning Optimization

Optimasi:

* reusable planning pattern,
* previous episode reference,
* story template reuse,
* context caching.

---

# Future Enhancement

Planning Engine dapat dikembangkan dengan:

* adaptive planning,
* narrative intelligence,
* automatic story arc management,
* multi-season planning.

---

# Relationship With Documentation

```
07-engine-spec/planning-runtime.md

↓

08-implementation-design/planning-engine-design.md

↓

Planning Engine Implementation
```

---

# Conclusion

Planning Engine adalah otak struktural dari Suro & Buya AI Engine.

Alurnya:

```
Creator Intent

↓

Planning Engine

↓

Structured Story Plan

↓

Generation Pipeline

↓

Validated Serial Content
```

Dengan Planning Engine, AI tidak sekadar menghasilkan teks, tetapi memahami bagaimana sebuah episode harus dibangun sebelum diproduksi.
