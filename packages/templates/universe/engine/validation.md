# Validation Template

Version: 1.0

Template Type:

```text
Engine Template
```

Domain:

```text
AI Validation Runtime
```

Workflow Position:

```text
Generation Runtime

↓

Validation Runtime

↓

Validation Result

↓

Review Runtime

↓

Production Pipeline
```

---

# Validation Identity

## Basic Information

```yaml
validation_id:
request_id:
context_id:
target_type:
target_id:
validation_type:
status:
created:
updated:
```

Example:

```yaml
validation_id: VAL-SB-001
request_id: REQ-SB-001
context_id: CTX-SB-001
target_type: Episode
target_id: EP-SB-001
validation_type: Full Validation
status: Running
```

---

# Validation Purpose

## Objective

Tujuan validasi:

```text
[Why this validation is executed]
```

Contoh:

* memastikan cerita sesuai canon,
* memastikan object sesuai schema,
* memastikan hasil siap direview.

---

# Validation Target

Objek yang diperiksa:

```yaml
target:

type:

id:

version:

source:
```

Contoh:

```yaml
target:

type: Episode

id: EP-SB-001

version: v1.0

source: Generation Runtime
```

---

# Validation Scope

Area validasi:

```yaml
scope:

canon:

schema:

continuity:

quality:

production:
```

---

# Canon Validation

Pemeriksaan terhadap Universe Bible.

## Character Validation

```yaml
character_validation:

status:

checks:

- character_id:
  rule:
  result:
```

Pemeriksaan:

* personality konsisten,
* kemampuan sesuai,
* hubungan karakter valid,
* perilaku sesuai Character Bible.

---

## World Validation

```yaml
world_validation:

status:

checks:

- world_element:
  rule:
  result:
```

Pemeriksaan:

* lokasi valid,
* aturan dunia sesuai,
* budaya konsisten.

---

## Story Validation

```yaml
story_validation:

status:

checks:

- story_rule:
  result:
```

Pemeriksaan:

* tema sesuai,
* konflik sesuai,
* tidak membuat canon baru.

---

## Visual Validation

```yaml
visual_validation:

status:

checks:

- visual_rule:
  result:
```

Pemeriksaan:

* desain karakter,
* gaya visual,
* environment.

---

# Schema Validation

Pemeriksaan struktur data:

```yaml
schema_validation:

schema:

version:

status:

errors:

warnings:
```

---

## Schema Errors

```yaml
errors:

- field:
  issue:
  severity:
```

Contoh:

```yaml
errors:

- field: character_id
  issue: Missing required field
  severity: Critical
```

---

# Continuity Validation

Pemeriksaan kesinambungan cerita.

```yaml
continuity_validation:

timeline:

character_state:

world_state:

story_state:
```

---

## Timeline Check

```yaml
timeline:

status:

issues:
```

---

## Character Continuity

```yaml
character_continuity:

- character_id:
  previous_state:
  current_state:
  valid:
```

---

## World Continuity

```yaml
world_continuity:

- element:
  previous_reference:
  current_usage:
  valid:
```

---

# Quality Validation

Pemeriksaan kualitas kreatif.

## Narrative Quality

```yaml
narrative_quality:

structure:

pacing:

conflict:

resolution:
```

---

## Character Quality

```yaml
character_quality:

consistency:

emotion:

dialogue:
```

---

## Audience Quality

Khusus serial anak:

```yaml
audience_quality:

age_appropriateness:

educational_value:

entertainment_value:
```

---

# Production Validation

Kesiapan produksi:

```yaml
production_validation:

scene_complete:

asset_ready:

visual_ready:

audio_ready:

format_ready:
```

---

# Validation Result

## Summary

```yaml
result:

status:

score:

critical_issue_count:

warning_count:
```

Status:

```text
PASS

↓

PASS WITH WARNING

↓

NEEDS REVISION

↓

FAILED
```

---

# Issues Report

Semua temuan:

```yaml
issues:

- issue_id:
  category:
  description:
  severity:
  recommendation:
```

Severity:

```text
Critical

↓

High

↓

Medium

↓

Low
```

---

# Validation Decision

Keputusan engine:

```yaml
decision:

action:

next_step:

reason:
```

Contoh:

```yaml
decision:

action: Send To Review

next_step: Review Runtime

reason: Validation Passed
```

---

# Validation Lifecycle

```text
Created

↓

Running

↓

Checking Canon

↓

Checking Schema

↓

Checking Continuity

↓

Checking Quality

↓

Completed

↓

Archived
```

---

# Validation Metadata

```yaml
metadata:

id:

version:

engine_version:

created:

updated:

validator:

source:
```

---

# Output

Validation Template menghasilkan:

```text
Validation Object

↓

validation.schema.json

↓

Validation Result

↓

Review Runtime Decision

↓

Production Gate
```

---

# Template Rules

1. Validation wajib dilakukan sebelum review.

2. Canon validation memiliki prioritas tertinggi.

3. Validation tidak boleh memperbaiki canon secara otomatis.

4. Semua issue harus memiliki source reference.

5. Failed validation harus menghentikan pipeline.

6. Validation result harus dapat diaudit ulang.

7. Validation version harus tercatat.
