# Template Guideline

Version: 1.0

---

# Introduction

Template System adalah standar struktur dokumen dan data yang digunakan oleh **Suro & Buya AI Engine** untuk menjaga konsistensi proses kreatif, engine workflow, dan production pipeline.

Template bukan sekadar format kosong.

Template berfungsi sebagai:

* blueprint pembuatan object,
* standar input dan output workflow,
* penghubung antara creator, AI Engine, dan production,
* mekanisme konsistensi data.

---

# Template Philosophy

## Template as Creative Framework

Template membantu creator memberikan informasi dengan struktur yang benar.

Template tidak menggantikan kreativitas.

Prinsip:

```
Creator Intent

↓

Template Structure

↓

AI Processing

↓

Creative Output
```

---

## Template is Not Canon

Template bukan sumber kebenaran cerita.

Urutan otoritas:

```
Universe Bible

↓

Schema Definition

↓

Workflow Rules

↓

Template

↓

Generated Output
```

Apabila template bertentangan dengan Universe Bible:

```
Universe Bible selalu menang.
```

---

# Template Purpose

Template digunakan untuk:

## 1. Consistency

Memastikan object memiliki struktur yang sama.

Contoh:

Semua character menggunakan:

```
character.md
```

Semua episode menggunakan:

```
episode.md
```

---

## 2. Guidance

Membantu creator mengisi informasi penting.

---

## 3. Engine Compatibility

Memastikan AI Engine menerima input dalam format yang dapat diproses.

---

## 4. Production Readiness

Menghasilkan output yang siap diteruskan ke tahap produksi.

---

# Template Categories

Struktur template:

```
templates/

├── creator/
├── engine/
├── prompt/
├── api/
└── schema/
```

---

# Creator Templates

Lokasi:

```
templates/creator/
```

Digunakan oleh creator workflow.

Alur:

```
Character

↓

World

↓

Story

↓

Season

↓

Episode

↓

Review

↓

Production
```

---

# Character Template

File:

```
templates/creator/character.md
```

Tujuan:

Membuat character object sesuai Character Bible.

Isi utama:

* identity,
* personality,
* appearance,
* relationship,
* background,
* behavior.

Output:

```
character.schema.json
```

---

# World Template

File:

```
templates/creator/world.md
```

Tujuan:

Membuat world object.

Isi:

* location,
* culture,
* environment,
* rules,
* history.

Output:

```
world object
```

---

# Story Template

File:

```
templates/creator/story.md
```

Tujuan:

Membangun struktur cerita.

Isi:

* theme,
* premise,
* conflict,
* resolution,
* narrative direction.

---

# Season Template

File:

```
templates/creator/season.md
```

Tujuan:

Membuat perencanaan satu musim serial.

Isi:

* season goal,
* episode list,
* narrative arc,
* progression.

---

# Episode Template

File:

```
templates/creator/episode.md
```

Tujuan:

Membuat episode specification.

Isi:

* title,
* objective,
* story beat,
* scene breakdown,
* dialogue requirement.

---

# Review Template

File:

```
templates/creator/review.md
```

Tujuan:

Membuat proses evaluasi.

Isi:

* review target,
* issue,
* feedback,
* decision.

---

# Production Template

File:

```
templates/creator/production.md
```

Tujuan:

Mengubah cerita menjadi production package.

Isi:

* scene requirement,
* asset requirement,
* voice requirement,
* production notes.

---

# Engine Templates

Lokasi:

```
templates/engine/
```

Digunakan internal AI Engine.

Tujuan:

Mengatur komunikasi antar runtime component.

---

# Planning Template

File:

```
templates/engine/planning.md
```

Digunakan oleh:

```
Planning Runtime
```

Fungsi:

Mengubah intent menjadi execution plan.

Input:

```
Creator Intent
```

Output:

```
Planning Object
```

---

# Context Template

File:

```
templates/engine/context.md
```

Digunakan oleh:

```
Context Builder
```

Fungsi:

Menggabungkan:

* Universe Bible data,
* previous story state,
* production requirement.

---

# Validation Template

File:

```
templates/engine/validation.md
```

Digunakan oleh:

```
Validation Runtime
```

Fungsi:

Memeriksa:

* canon consistency,
* schema validity,
* workflow compliance.

---

# Review Template

File:

```
templates/engine/review.md
```

Digunakan untuk:

```
Review Runtime
```

Fungsi:

Menghasilkan review package.

---

# Production Template

File:

```
templates/engine/production.md
```

Digunakan untuk:

```
Production Runtime
```

Fungsi:

Menghasilkan production-ready output.

---

# Execution Template

File:

```
templates/engine/execution.md
```

Digunakan oleh:

```
Execution Runtime
```

Fungsi:

Menyimpan execution instruction dan status.

---

# Prompt Templates

Lokasi:

```
templates/prompt/
```

Digunakan untuk mengatur prompt pipeline.

---

# Planning Prompt

File:

```
planning.prompt.md
```

Tujuan:

Mengubah creator request menjadi plan.

---

# Generation Prompt

File:

```
generation.prompt.md
```

Tujuan:

Menghasilkan:

* story,
* scene,
* dialogue.

---

# Validation Prompt

File:

```
validation.prompt.md
```

Tujuan:

Melakukan pengecekan terhadap output AI.

---

# Review Prompt

File:

```
review.prompt.md
```

Tujuan:

Membuat evaluasi kualitas.

---

# Production Prompt

File:

```
production.prompt.md
```

Tujuan:

Mengubah hasil cerita menjadi production package.

---

# API Templates

Lokasi:

```
templates/api/
```

Digunakan untuk dokumentasi komunikasi API.

---

## Request Template

File:

```
request.json
```

Standar struktur request.

---

## Response Template

File:

```
response.json
```

Standar struktur response.

---

## Error Template

File:

```
error.json
```

Standar error handling.

---

# Schema Templates

Lokasi:

```
templates/schema/
```

Digunakan sebagai dasar pembuatan schema.

---

## Object Template

File:

```
object.md
```

Mendefinisikan:

* object identity,
* metadata,
* relationship.

---

## Metadata Template

File:

```
metadata.md
```

Mendefinisikan:

* id,
* version,
* timestamps,
* ownership.

---

## Versioning Template

File:

```
versioning.md
```

Mendefinisikan:

* version strategy,
* compatibility,
* migration.

---

# Template Lifecycle

Setiap template mengikuti lifecycle:

```
Draft

↓

Review

↓

Approved

↓

Active

↓

Deprecated
```

---

# Draft

Template masih dalam pengembangan.

Belum digunakan engine.

---

# Review

Template diperiksa:

* struktur,
* kebutuhan workflow,
* compatibility.

---

# Approved

Template resmi digunakan.

---

# Active

Template menjadi bagian sistem.

---

# Deprecated

Template lama tidak digunakan tetapi tetap disimpan.

---

# Template Versioning

Format:

```
template-name-v{major}.{minor}
```

Contoh:

```
episode-template-v1.0
```

---

# Major Version

Digunakan jika:

* struktur berubah,
* field utama berubah,
* workflow berubah.

Contoh:

```
v1.0 → v2.0
```

---

# Minor Version

Digunakan jika:

* penambahan field,
* perbaikan instruksi,
* klarifikasi.

Contoh:

```
v1.0 → v1.1
```

---

# Relationship With Creator Workflow

Template mengikuti workflow creator.

```
Character Template

↓

World Template

↓

Story Template

↓

Season Template

↓

Episode Template

↓

Review Template

↓

Production Template
```

---

# Relationship With Engine Runtime

Template menjadi kontrak antara creator dan engine.

```
Creator Input

↓

Template

↓

Engine Runtime

↓

Generated Output

↓

Validation
```

---

# Template Management Rules

## Rule 1

Setiap workflow object harus memiliki template.

---

## Rule 2

Template tidak boleh membuat canon baru.

---

## Rule 3

Perubahan template harus menggunakan versioning.

---

## Rule 4

Template aktif harus kompatibel dengan schema.

---

## Rule 5

Template deprecated tidak boleh digunakan untuk produksi baru.

---

# Future Extension

Template System dapat dikembangkan dengan:

* template registry,
* automatic validation,
* dynamic template generation,
* template marketplace internal,
* AI assisted template completion.

Implementasi dilakukan setelah:

```
AI Engine Implementation Design
```

---

# Conclusion

Template System menjaga agar seluruh proses Suro & Buya AI Engine berjalan konsisten.

Hubungan akhirnya:

```
Universe Bible

↓

Template System

↓

AI Engine

↓

Production Pipeline

↓

Serialized Content
```

Template adalah bahasa bersama antara:

* creator,
* AI Engine,
* production team.
