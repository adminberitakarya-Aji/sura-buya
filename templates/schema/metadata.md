# Metadata Schema Template

Version: 1.0

Template Type:

```text
Schema Template
```

Domain:

```text
Suro & Buya AI Engine Metadata System
```

---

# Purpose

Metadata adalah informasi yang menjelaskan:

```text
Object

↓

Identity Context

↓

Origin

↓

Ownership

↓

Lifecycle

↓

Audit History
```

Metadata tidak berisi isi kreatif utama.

Metadata hanya menjelaskan konteks object.

---

# Metadata Philosophy

Setiap object harus dapat menjawab:

```
Apa object ini?

Dari mana asalnya?

Siapa yang membuatnya?

Versi berapa?

Statusnya apa?

Bagaimana perubahannya?
```

---

# Metadata Structure

Standar metadata:

```yaml
metadata:

identity:

source:

ownership:

lifecycle:

classification:

timestamps:

tags:

audit:
```

---

# Identity Metadata

Informasi identitas tambahan.

Template:

```yaml
identity:

object_id:

object_type:

version:

namespace:
```

Contoh:

```yaml
identity:

object_id: EP-SB-001

object_type: Episode

version: 1.0

namespace: SURO-BUYA
```

---

# Source Metadata

Menjelaskan asal object.

Template:

```yaml
source:

origin:

reference:

created_from:

universe_reference:
```

Contoh:

```yaml
source:

origin: Creator Input

reference:
Story Bible

universe_reference:
SURO-BUYA
```

---

# Source Classification

Jenis sumber:

```text
Universe Bible

Creator Input

AI Generated

Human Edited

Production Input

External Reference
```

---

# Ownership Metadata

Menentukan pemilik object.

Template:

```yaml
ownership:

owner:

creator:

team:

permission:
```

Contoh:

```yaml
ownership:

owner:
Suro Buya Studio

creator:
Human Creator
```

---

# Lifecycle Metadata

Mengatur perjalanan object.

Template:

```yaml
lifecycle:

status:

stage:

published:

archived:
```

---

## Lifecycle Status

Standar:

```text
Draft

↓

Review

↓

Approved

↓

Active

↓

Deprecated

↓

Archived
```

---

# Classification Metadata

Mengelompokkan object.

Template:

```yaml
classification:

category:

domain:

visibility:

priority:
```

Contoh:

```yaml
classification:

category:
Story Content

domain:
Universe

visibility:
Internal

priority:
High
```

---

# Timestamp Metadata

Waktu perubahan object.

Template:

```yaml
timestamps:

created:

updated:

approved:

published:
```

Format:

```text
ISO-8601
```

Contoh:

```text
2026-01-01T10:00:00Z
```

---

# Tag Metadata

Label pencarian.

Template:

```yaml
tags:

- tag1

- tag2
```

Contoh:

```yaml
tags:

- adventure

- children

- nature
```

---

# Audit Metadata

Riwayat perubahan.

Template:

```yaml
audit:

created_by:

updated_by:

changes:

- version:

  action:

  actor:

  timestamp:
```

---

# Audit Action

Jenis perubahan:

```text
CREATE

UPDATE

REVIEW

APPROVE

REJECT

PUBLISH

ARCHIVE
```

---

# Relationship Metadata

Metadata dapat menyimpan hubungan administratif.

Template:

```yaml
relationships:

parent:

children:

references:
```

Contoh:

```yaml
relationships:

parent:
Season-01

children:
Episode-01
```

---

# Version Metadata

Metadata version:

```yaml
versioning:

current:

previous:

change_reason:
```

Contoh:

```yaml
versioning:

current:
1.1

previous:
1.0

change_reason:
Dialogue revision
```

---

# Complete Metadata Example

```yaml
metadata:

identity:

  object_id:
  EP-SB-001

  object_type:
  Episode

  version:
  1.0


source:

  origin:
  AI Generated

  reference:
  Story Bible


ownership:

  owner:
  Suro Buya Studio


lifecycle:

  status:
  Approved


classification:

  category:
  Story


timestamps:

  created:
  2026-01-01T10:00:00Z


tags:

- adventure

- children


audit:

  created_by:
  Creator
```

---

# Metadata Rules

1. Semua object wajib memiliki metadata.

2. Metadata tidak boleh menyimpan canon kreatif.

3. Metadata harus dapat dibaca oleh Runtime.

4. Metadata harus memiliki source reference.

5. Metadata harus mendukung audit.

6. Metadata harus mengikuti versioning system.

7. Metadata tidak boleh hilang ketika object berpindah pipeline.

---

# Schema Mapping

Metadata Template digunakan untuk:

```text
Metadata Template

↓

Object Schema

↓

API Response

↓

Storage Model

↓

Audit System
```

---

# Template Usage

Digunakan oleh:

```text
Character Object

World Object

Story Object

Episode Object

Scene Object

Dialogue Object

Asset Object

Production Object

Execution Object

Review Object
```

---

Status:

```text
templates/

schema/

├── object.md        ✅
├── metadata.md      ✅
└── versioning.md    ⏳
```

Berikutnya:

```text
templates/schema/versioning.md
```

Ini akan melengkapi seluruh **Template Schema Layer** dan seluruh folder:

```text
templates/

├── creator/   ✅
├── engine/    ✅
├── prompt/    ✅
├── api/       ✅
└── schema/    ⏳
```
