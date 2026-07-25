# Object Schema Template

Version: 1.0

Template Type:

```text
Schema Template
```

Domain:

```text
Suro & Buya AI Engine Object Model
```

---

# Purpose

Template ini mendefinisikan standar semua object dalam Suro & Buya AI Engine.

Object adalah representasi terstruktur dari:

```text
Entity

↓

State

↓

Relationship

↓

Metadata

↓

Lifecycle
```

---

# Object Philosophy

Setiap object engine harus:

1. Memiliki identitas unik.

2. Memiliki version.

3. Memiliki metadata.

4. Memiliki relationship.

5. Memiliki lifecycle.

6. Dapat dilacak sumbernya.

7. Dapat divalidasi.

---

# Object Structure

Standar object:

```yaml
object:

identity:

metadata:

content:

relationships:

state:

validation:

audit:
```

---

# Identity

Setiap object wajib memiliki identitas.

Template:

```yaml
identity:

id:

type:

version:

name:
```

Contoh:

```yaml
identity:

id: EP-SB-001

type: Episode

version: 1.0

name: Episode 01
```

---

# Object ID Convention

Format:

```text
TYPE-SYSTEM-NUMBER
```

Contoh:

```text
CHAR-SB-001

WORLD-SB-001

STORY-SB-001

EP-SB-001

SCENE-SB-001
```

---

# Object Type

Jenis object:

```text
Universe Object

Character Object

World Object

Story Object

Season Object

Episode Object

Scene Object

Dialogue Object

Production Object

Asset Object

Execution Object

Review Object
```

---

# Metadata

Semua object wajib memiliki metadata.

Template:

```yaml
metadata:

created:

updated:

created_by:

source:

tags:

owner:
```

Contoh:

```yaml
metadata:

created: 2026-01-01

source: Universe Bible

created_by: Creator
```

---

# Content

Bagian utama object.

Template:

```yaml
content:

properties:

attributes:

description:
```

Isi bergantung pada object type.

Contoh:

Character:

```yaml
content:

name:

personality:

appearance:

background:
```

Episode:

```yaml
content:

title:

theme:

summary:

scenes:
```

---

# Relationship

Object harus dapat memiliki hubungan.

Template:

```yaml
relationships:

- type:

  target:

  relationship:
```

Contoh:

```yaml
relationships:

- type: Character

  target: BUYA

  relationship: Main Character
```

---

# State

Object memiliki kondisi.

Template:

```yaml
state:

status:

lifecycle:

current_version:
```

Contoh:

```yaml
state:

status: Active

lifecycle: Published

current_version: 1.0
```

---

# Lifecycle

Standar lifecycle:

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

# Validation

Semua object dapat divalidasi.

Template:

```yaml
validation:

schema:

validated:

validator:

status:
```

Contoh:

```yaml
validation:

schema: episode.schema.json

status: Passed
```

---

# Audit

Semua perubahan harus tercatat.

Template:

```yaml
audit:

history:

- version:

  action:

  timestamp:

  actor:
```

---

# Object Reference

Object harus dapat menunjuk sumbernya.

Template:

```yaml
reference:

universe:

source:

parent:
```

Contoh:

```yaml
reference:

universe:
SURO-BUYA

source:
Character Bible

parent:
Season 01
```

---

# Object Example

## Episode Object

```yaml
object:

identity:

  id: EP-SB-001

  type: Episode

  version: 1.0


metadata:

  source: Story Bible


content:

  title: Adventure Episode


relationships:

  characters:

  - SURO

  - BUYA


state:

  status: Approved


validation:

  status: Passed
```

---

# Object Rules

## Required Fields

Semua object wajib memiliki:

```text
id

type

version

metadata

content

state
```

---

## Forbidden Pattern

Object tidak boleh:

```text
- tanpa identity

- tanpa source reference

- tanpa version

- memiliki data canon tanpa approval

- memiliki relationship yang tidak valid
```

---

# Object Relationship Rules

Relationship harus:

* memiliki target valid,
* memiliki type jelas,
* dapat diverifikasi.

Contoh valid:

```text
Episode

↓

contains

↓

Scene
```

---

# Schema Mapping

Object Template digunakan untuk:

```text
Object Template

↓

JSON Schema

↓

Runtime Validation

↓

Database Model

↓

API Contract
```

---

# Template Rules

1. Semua schema harus mengikuti Object Template.

2. Semua object harus immutable setelah approved.

3. Perubahan object menggunakan versioning.

4. Object harus memiliki audit history.

5. Object harus memiliki Universe Reference.

6. Object tidak boleh menyimpan prompt internal.

7. Object harus dapat digunakan oleh Runtime Engine.

```
```
