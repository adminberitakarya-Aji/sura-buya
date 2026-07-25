# Versioning Schema Template

Version: 1.0

Template Type:

```text
Schema Template
```

Domain:

```text
Suro & Buya AI Engine Version Management
```

---

# Purpose

Versioning digunakan untuk mengelola perubahan terhadap:

```text
Object

↓

Schema

↓

Prompt

↓

Workflow

↓

API Contract

↓

Asset

↓

Engine Configuration
```

Setiap perubahan harus dapat diketahui:

```text
Apa yang berubah?

Mengapa berubah?

Siapa yang mengubah?

Dampaknya apa?

Versi sebelumnya apa?
```

---

# Versioning Philosophy

Prinsip utama:

1. Tidak ada perubahan tanpa version.

2. Object yang sudah approved tidak boleh berubah langsung.

3. Perubahan harus menghasilkan versi baru.

4. Versi lama harus tetap dapat dilacak.

5. Breaking change harus memiliki migrasi.

6. History perubahan wajib tersedia.

---

# Version Object Structure

Standar:

```yaml
versioning:

version:

previous_version:

change_type:

change_reason:

impact:

migration:

history:
```

---

# Version Format

Menggunakan:

```text
Semantic Versioning
```

Format:

```text
MAJOR.MINOR.PATCH
```

Contoh:

```text
1.0.0

1.1.0

1.1.1

2.0.0
```

---

# Version Rules

## MAJOR Version

Digunakan jika:

```text
Breaking Change
```

Contoh:

* perubahan struktur object,
* perubahan schema yang tidak kompatibel,
* perubahan workflow utama,
* perubahan API contract.

Contoh:

```text
Episode Schema

1.0.0

↓

2.0.0
```

---

## MINOR Version

Digunakan jika:

```text
New Capability
```

Contoh:

* menambah field baru,
* menambah kemampuan engine,
* menambah optional property.

Contoh:

```text
Episode Schema

1.0.0

↓

1.1.0
```

---

## PATCH Version

Digunakan untuk:

```text
Small Fix
```

Contoh:

* typo,
* dokumentasi,
* bug kecil,
* koreksi metadata.

Contoh:

```text
Episode Schema

1.0.0

↓

1.0.1
```

---

# Version Lifecycle

```text
Draft

↓

Review

↓

Approved

↓

Released

↓

Deprecated

↓

Archived
```

---

# Object Versioning

Setiap object memiliki:

```yaml
object_version:

current:

previous:

status:
```

Contoh:

```yaml
object_version:

current:
1.2.0

previous:
1.1.0

status:
Active
```

---

# Object Change Example

Episode:

Versi awal:

```text
EP-SB-001 v1.0.0
```

Perubahan:

```text
Tambah scene baru
```

Versi baru:

```text
EP-SB-001 v1.1.0
```

History:

```yaml
history:

- version:
  1.1.0

  change:
  Added new scene

  actor:
  Creator
```

---

# Schema Versioning

Schema harus memiliki:

```yaml
schema_version:

name:

version:

compatible_with:

deprecated:
```

Contoh:

```yaml
schema_version:

name:
episode.schema.json

version:
1.1.0

compatible_with:
engine 1.x
```

---

# Prompt Versioning

Setiap prompt engine harus memiliki versi.

Contoh:

```text
generation.prompt.md

v1.0.0

↓

v1.1.0
```

Perubahan:

```text
Added dialogue quality rules
```

---

# Workflow Versioning

Workflow:

```yaml
workflow_version:

id:

version:

steps:

changes:
```

Contoh:

```yaml
workflow_version:

id:
EPISODE_GENERATION

version:
1.1.0

changes:
Added review checkpoint
```

---

# API Versioning

API menggunakan:

```text
/api/v1/
```

Contoh:

```text
/api/v1/episodes
```

Breaking change:

```text
/api/v2/episodes
```

---

# Compatibility Rules

## Backward Compatibility

Versi baru harus tetap dapat membaca:

```text
Old Object

↓

New Runtime
```

Jika memungkinkan.

---

## Forward Compatibility

Runtime lama tidak wajib membaca object baru.

Namun harus:

* memberikan error jelas,
* tidak merusak data.

---

# Migration Strategy

Jika terjadi perubahan besar:

```yaml
migration:

required:

from:

to:

steps:
```

Contoh:

```yaml
migration:

required:
true

from:
1.0.0

to:
2.0.0

steps:

- migrate field structure
- update references
```

---

# Change Log Structure

Setiap perubahan:

```yaml
change_log:

version:

date:

author:

summary:

impact:
```

---

# Deprecation Rules

Object dapat deprecated jika:

```text
- digantikan versi baru

- tidak digunakan lagi

- memiliki struktur lama
```

Status:

```text
Active

Deprecated

Archived
```

Object deprecated:

* tidak boleh digunakan untuk generation baru,
* tetap tersedia untuk history.

---

# Complete Version Example

```yaml
versioning:

version:
1.2.0

previous_version:
1.1.0

change_type:
MINOR

change_reason:
Added new production metadata

impact:
Low

migration:
Not Required

history:

- version:
  1.2.0

  action:
  UPDATE

  actor:
  Creator
```

---

# Versioning Rules

1. Semua perubahan harus memiliki version.

2. Approved object tidak boleh overwrite.

3. History perubahan wajib disimpan.

4. Breaking change harus menggunakan MAJOR version.

5. Prompt, schema, API, dan workflow harus versioned.

6. Version harus dapat dilacak dari output sampai source.

7. Universe Bible version harus selalu tercatat.

---

# Schema Mapping

Versioning digunakan oleh:

```text
Versioning Template

↓

Object Schema

↓

API Version

↓

Prompt Version

↓

Workflow Runtime

↓

Production Pipeline
```

---

Status:

```text
templates/

schema/

├── object.md        ✅
├── metadata.md      ✅
└── versioning.md    ✅
```

---

# Templates Completion Status

```text
templates/

├── creator/    ✅ COMPLETE

├── engine/     ✅ COMPLETE

├── prompt/     ✅ COMPLETE

├── api/        ✅ COMPLETE

└── schema/     ✅ COMPLETE
```

Dengan selesai:

```text
templates/
```

maka seluruh **Reusable Template System Suro & Buya AI Engine v1.0** sudah lengkap.

Tahap dokumentasi berikutnya yang sesuai urutan:

```text
docs/00-foundation/

├── assets-guideline.md
└── template-guideline.md
```

baru setelah itu masuk:

```text
docs/07-engine-spec/

AI Engine Implementation Design
```
