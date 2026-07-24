# Assets Guideline

Version: 1.0

---

# Introduction

Assets adalah bagian pendukung dari ekosistem dokumentasi dan produksi **Suro & Buya AI Engine**.

Assets bukan sekadar file visual atau dokumen pendukung.

Dalam sistem ini, assets berfungsi sebagai:

* representasi visual,
* referensi produksi,
* pendukung dokumentasi arsitektur,
* penghubung antara Universe Bible dan Production Pipeline.

Asset harus dikelola secara terstruktur agar AI Engine, creator, dan production team memiliki referensi yang konsisten.

---

# Asset Philosophy

## Asset as Structured Knowledge

Setiap asset memiliki makna dan konteks.

Asset bukan file yang berdiri sendiri.

Setiap asset harus menjawab:

* asset ini berasal dari bagian mana?
* digunakan untuk kebutuhan apa?
* siapa yang menggunakan?
* bagaimana lifecycle-nya?
* bagaimana hubungannya dengan canon Universe Bible?

---

## Asset is Not Canon

Assets tidak menjadi sumber kebenaran utama.

Urutan otoritas:

```
Universe Bible

↓

Schema Definition

↓

Documentation

↓

Assets
```

Asset hanya menjadi representasi atau pendukung.

Contoh:

Character image bukan sumber karakter.

Sumber karakter tetap:

```
universe-bible/
└── 01-character-bible/
```

---

# Asset Classification

Asset dikategorikan berdasarkan domain penggunaannya.

Struktur utama:

```
assets/

├── architecture/
├── creator/
├── engine/
├── production/
├── universe/
├── logos/
├── icons/
└── images/
```

---

# Architecture Assets

Lokasi:

```
assets/architecture/
```

Digunakan untuk dokumentasi sistem AI Engine.

Isi:

```
architecture/

├── component-diagram/
├── deployment-diagram/
├── data-flow/
├── sequence-diagram/
└── state-machine/
```

---

## Component Diagram

Berisi:

* engine component relationship,
* module boundaries,
* service architecture.

Contoh:

```
Orchestrator

↓

Runtime

↓

Planner

↓

Generator

↓

Validator
```

---

## Deployment Diagram

Berisi:

* deployment architecture,
* infrastructure view,
* runtime environment.

---

## Data Flow

Berisi:

* input flow,
* processing flow,
* output flow.

Contoh:

```
Creator Intent

↓

Context Retrieval

↓

Story Generation

↓

Validation

↓

Production Package
```

---

## Sequence Diagram

Berisi:

* interaction antar komponen,
* execution order,
* API flow.

---

## State Machine

Berisi:

* lifecycle object,
* workflow state,
* transition rules.

---

# Creator Assets

Lokasi:

```
assets/creator/
```

Digunakan untuk mendukung creator workflow.

Struktur:

```
creator/

├── workflow/
└── ui-mockup/
```

---

## Workflow Assets

Berisi visualisasi:

* character creation,
* world creation,
* story planning,
* episode workflow,
* review workflow.

---

## UI Mockup Assets

Berisi:

* interface concept,
* creator workspace design,
* interaction flow.

---

# Engine Assets

Lokasi:

```
assets/engine/
```

Digunakan untuk dokumentasi internal AI Engine.

Struktur:

```
engine/

├── workflow/
├── runtime/
├── orchestrator/
└── prompt-flow/
```

---

## Workflow Assets

Berisi:

* engine pipeline,
* execution flow,
* process visualization.

---

## Runtime Assets

Berisi:

* runtime lifecycle,
* execution state,
* memory flow.

---

## Orchestrator Assets

Berisi:

* task routing,
* agent coordination,
* module interaction.

---

## Prompt Flow Assets

Berisi:

* prompt pipeline,
* context injection,
* generation stages.

---

# Production Assets

Lokasi:

```
assets/production/
```

Digunakan untuk kebutuhan produksi serial.

Struktur:

```
production/

├── pipeline/
├── storyboard/
└── publishing/
```

---

## Pipeline Assets

Berisi:

* production workflow,
* handoff process,
* production stages.

---

## Storyboard Assets

Berisi:

* shot planning,
* scene visualization,
* camera reference.

---

## Publishing Assets

Berisi:

* distribution workflow,
* release flow,
* publishing documentation.

---

# Universe Assets

Lokasi:

```
assets/universe/
```

Berhubungan langsung dengan Universe Bible.

Struktur:

```
universe/

├── characters/
├── world/
├── story/
└── visual/
```

---

# Character Assets

Berisi:

* character reference image,
* expression sheet,
* pose reference,
* costume reference.

Sumber canon:

```
universe-bible/
└── 01-character-bible/
```

---

# World Assets

Berisi:

* location reference,
* environment concept,
* map,
* cultural reference.

Sumber canon:

```
universe-bible/
└── 02-world-bible/
```

---

# Story Assets

Berisi:

* story timeline,
* relationship diagram,
* narrative reference.

Sumber canon:

```
universe-bible/
└── 03-story-bible/
```

---

# Visual Assets

Berisi:

* style reference,
* color reference,
* visual language.

Sumber canon:

```
universe-bible/
└── 04-visual-bible/
```

---

# Naming Convention

Semua asset harus menggunakan format konsisten.

Format:

```
{domain}-{type}-{name}-{version}
```

Contoh:

```
character-sheet-suro-v1.png

world-map-nusantara-v1.png

engine-flow-generation-v2.svg
```

---

# File Naming Rules

Gunakan:

* lowercase,
* hyphen separator,
* tanpa spasi.

Benar:

```
episode-flow-v1.png
```

Salah:

```
Episode Flow Final.png
```

---

# Version Convention

Format:

```
v{major}.{minor}
```

Contoh:

```
v1.0
v1.1
v2.0
```

---

## Major Version

Digunakan jika terjadi perubahan besar.

Contoh:

```
v1.0 → v2.0
```

Perubahan:

* konsep berubah,
* struktur berubah,
* fungsi berubah.

---

## Minor Version

Digunakan untuk perubahan kecil.

Contoh:

```
v1.0 → v1.1
```

Perubahan:

* revisi visual,
* tambahan informasi,
* improvement.

---

# Asset Lifecycle

Setiap asset mengikuti lifecycle:

```
Draft

↓

Review

↓

Approved

↓

Production Use

↓

Archived
```

---

# Draft

Asset masih dalam tahap:

* eksplorasi,
* konsep,
* revisi.

Belum digunakan sebagai referensi resmi.

---

# Review

Asset diperiksa:

* kesesuaian dengan Universe Bible,
* kualitas,
* kebutuhan produksi.

---

# Approved

Asset telah:

* disetujui,
* memiliki versi,
* siap digunakan.

---

# Production Use

Asset digunakan dalam:

* engine workflow,
* creator workflow,
* production pipeline.

---

# Archived

Asset lama tetap disimpan untuk:

* histori,
* audit,
* referensi perubahan.

---

# Relationship With Universe Bible

Hubungan:

```
Universe Bible

↓

Asset Generation

↓

Asset Repository

↓

Production Usage
```

---

Aturan:

Asset tidak boleh mengubah canon.

Jika asset bertentangan dengan Universe Bible:

maka:

```
Universe Bible menang.
```

---

# Relationship With Production Pipeline

Asset menjadi input produksi:

```
Universe Bible

↓

Asset Preparation

↓

Production Pipeline

↓

Final Output
```

---

Contoh:

Character Bible

↓

Character Asset

↓

Animation Reference

↓

Production Character

---

# Asset Management Rules

## Rule 1

Setiap asset harus memiliki tujuan jelas.

---

## Rule 2

Tidak boleh ada asset tanpa hubungan domain.

---

## Rule 3

Asset final harus memiliki version identifier.

---

## Rule 4

Asset yang digunakan produksi harus melalui approval.

---

## Rule 5

Asset tidak boleh menjadi pengganti dokumentasi.

---

# Future Extension

Asset system dapat dikembangkan dengan:

* asset metadata schema,
* asset registry,
* asset validation,
* automated asset pipeline,
* AI asset retrieval.

Namun implementasi tersebut dilakukan setelah:

```
AI Engine Implementation Design
```

---

# Conclusion

Asset System memastikan seluruh komponen visual dan dokumentasi Suro & Buya tetap:

* konsisten,
* terlacak,
* dapat digunakan ulang,
* sesuai Universe Bible,
* siap mendukung production pipeline.

Asset bukan sumber cerita.

Asset adalah jembatan antara:

```
Creative Intent

↓

Universe Knowledge

↓

AI Engine

↓

Production Reality
```
