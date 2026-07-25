# Context Template

Version: 1.0

Template Type:

```text
Engine Template
```

Domain:

```text
AI Context Management Runtime
```

Workflow Position:

```text
Planning Runtime

↓

Retrieval Runtime

↓

Context Builder

↓

Context Object

↓

Generation Runtime
```

---

# Context Identity

## Basic Information

```yaml
context_id:
request_id:
planning_id:
context_type:
status:
created:
updated:
```

Example:

```yaml
context_id: CTX-SB-001
request_id: REQ-SB-001
planning_id: PLAN-SB-001
context_type: Episode Generation Context
status: Ready
```

---

# Context Purpose

## Context Objective

Tujuan context:

```text
[Why this context is created]
```

Contoh:

* menyediakan informasi karakter,
* menyediakan aturan dunia,
* menyediakan batasan canon,
* memberikan referensi produksi.

---

# Source Reference

## Universe Bible Sources

Sumber utama:

```yaml
sources:

character_bible:

world_bible:

story_bible:

visual_bible:

production_bible:
```

---

## Retrieved Documents

Dokumen yang berhasil diambil:

```yaml
retrieved_documents:

- document_id:
  source_type:
  path:
  version:
  relevance_score:
```

Contoh:

```yaml
retrieved_documents:

- document_id: CHAR-SURO-001
  source_type: Character Bible
  path:
  version: 1.0
  relevance_score:
```

---

# Character Context

Karakter yang digunakan:

```yaml
characters:

- character_id:
  name:
  role:
  personality:
  abilities:
  restrictions:
```

---

# World Context

Informasi dunia:

```yaml
world:

locations:

- location_id:
  name:
  description:

rules:

-

culture:

-
```

---

# Story Context

Informasi cerita:

```yaml
story:

story_id:

theme:

message:

story_arc:

constraints:
```

---

# Season Context

Jika cerita serial:

```yaml
season:

season_id:

season_number:

season_arc:

episode_position:
```

---

# Episode Context

Jika membuat episode:

```yaml
episode:

episode_id:

objective:

conflict:

characters:

locations:

requirements:
```

---

# Visual Context

Aturan visual:

```yaml
visual:

style:

character_design:

environment:

color_language:

restrictions:
```

---

# Production Context

Kebutuhan produksi:

```yaml
production:

format:

duration:

target_platform:

asset_requirement:

quality_standard:
```

---

# Canon Constraints

Aturan yang tidak boleh dilanggar:

```yaml
canon_constraints:

- rule:
  source:
  severity:
```

Contoh:

```yaml
canon_constraints:

- rule: Suro personality must remain curious
  source: Character Bible
  severity: Critical
```

---

# Generation Guidance

Panduan untuk AI:

```yaml
generation_guidance:

tone:

style:

focus:

avoid:
```

---

# Context Priority

Prioritas informasi:

```yaml
priority:

critical:

important:

reference:
```

Aturan:

```text
Critical

↓

Important

↓

Reference
```

---

# Context Validation

Status validasi:

```yaml
validation:

canon_validated:

schema_validated:

completeness_checked:

approved:
```

---

# Context Lifecycle

```text
Created

↓

Retrieving

↓

Building

↓

Validating

↓

Ready

↓

Consumed

↓

Archived
```

---

# Context Metadata

```yaml
metadata:

id:

version:

engine_version:

created:

updated:

created_by:

source:
```

---

# Output

Context Template menghasilkan:

```text
Context Object

↓

Generation Input

↓

Story Planner

↓

Scene Generator

↓

Dialogue Generator

↓

Validation Engine
```

---

# Template Rules

1. Context hanya boleh berasal dari sumber valid.

2. Universe Bible adalah sumber utama.

3. Context tidak boleh menambahkan canon baru.

4. Semua retrieved data harus memiliki source reference.

5. Context harus melewati validation sebelum generation.

6. Context version harus tercatat untuk audit.

7. Context yang sudah digunakan harus dapat direproduksi kembali.
