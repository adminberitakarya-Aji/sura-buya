# Review Template

Version: 1.0

Template Type:

```text id="v8m6xp"
Engine Template
```

Domain:

```text id="q3q4tu"
AI Review Runtime
```

Workflow Position:

```text id="j1qf3n"
Generation Runtime

↓

Validation Runtime

↓

Review Runtime

↓

Creator Approval

↓

Production Runtime
```

---

# Review Identity

## Basic Information

```yaml id="3tw4yu"
review_id:
request_id:
validation_id:
target_type:
target_id:
review_type:
status:
created:
updated:
```

Example:

```yaml id="0wv9cz"
review_id: REVIEW-ENGINE-SB-001
request_id: REQ-SB-001
validation_id: VAL-SB-001
target_type: Episode
target_id: EP-SB-001
review_type: Creative Approval
status: Pending
```

---

# Review Purpose

## Objective

Tujuan review:

```text id="t0n5l7"
[Why this review is required]
```

Contoh:

* menentukan kelayakan konten,
* meminta revisi,
* memberikan approval produksi.

---

# Review Target

Objek yang direview:

```yaml id="e5m8pc"
target:

type:

id:

version:

generated_by:

validation_result:
```

---

# Review Context

Context yang digunakan reviewer:

```yaml id="t7w1n4"
context:

creator_intent:

universe_context:

validation_summary:

previous_revision:
```

---

# Review Criteria

## Canon Compliance

Pemeriksaan canon:

```yaml id="p4n2cx"
canon_review:

character:

world:

story:

visual:

production:
```

---

## Creative Quality

Pemeriksaan kreatif:

```yaml id="u9t4fn"
creative_review:

story_quality:

character_quality:

emotional_quality:

audience_fit:
```

---

## Production Readiness

Pemeriksaan produksi:

```yaml id="x2g7ja"
production_review:

script_ready:

visual_ready:

audio_ready:

asset_ready:
```

---

# AI Review Analysis

Analisis dari AI Reviewer:

```yaml id="2g5m1b"
ai_analysis:

strengths:

weaknesses:

risks:

recommendations:
```

---

## Strengths

Kelebihan:

```text id="t8c6s2"
-
-
-
```

---

## Weaknesses

Kekurangan:

```text id="n7h2py"
-
-
-
```

---

## Risks

Potensi masalah:

```yaml id="d4z9qs"
risks:

- description:
  severity:
  impact:
```

---

# Creator Review Input

Input dari creator:

```yaml id="m8q3vw"
creator_feedback:

reviewer:

comments:

changes_requested:
```

---

# Revision Request

Jika membutuhkan perubahan:

```yaml id="z6m4hf"
revision_request:

required:

items:

priority:

deadline:
```

---

## Revision Items

```yaml id="p0x7ra"
items:

- item_id:
  category:
  description:
  expected_change:
```

Contoh:

```yaml id="8k9qwe"
items:

- item_id: REV-001
  category: Character
  description:
  expected_change:
```

---

# Review Decision

Keputusan akhir:

```yaml id="x4h8nc"
decision:

status:

approved_by:

approved_date:

reason:
```

Status:

```text id="f9r1uy"
Pending

↓

Approved

↓

Approved With Revision

↓

Rejected
```

---

# Workflow Action

Tindakan berikutnya:

```yaml id="q2w5zx"
next_action:

action:

destination:

reason:
```

Contoh:

```yaml id="v6p8cd"
next_action:

action: Continue Production

destination: Production Runtime

reason: Approved
```

---

# Review History

Riwayat keputusan:

```yaml id="a7c3je"
history:

- version:
  action:
  actor:
  date:
  notes:
```

---

# Approval Chain

Jika membutuhkan beberapa tahap approval:

```yaml id="h4n7qs"
approval_chain:

steps:

- role:
  status:
  approved_by:
```

Contoh:

```yaml id="e2k8mz"
approval_chain:

steps:

- role: Creator
  status: Approved
  approved_by:
```

---

# Review Lifecycle

```text id="8w6y9h"
Created

↓

AI Analysis

↓

Creator Review

↓

Revision (Optional)

↓

Approval

↓

Production Handoff

↓

Archived
```

---

# Review Metadata

```yaml id="z1p5dk"
metadata:

id:

version:

engine_version:

created:

updated:

source:

owner:
```

---

# Output

Review Template menghasilkan:

```text id="w7f3km"
Review Object

↓

review.schema.json

↓

Approval Decision

↓

Production Runtime Trigger
```

---

# Template Rules

1. Review tidak boleh mengganti canon.

2. Review hanya mengevaluasi hasil berdasarkan Universe Bible.

3. Semua approval harus memiliki reviewer.

4. Revision harus tercatat dalam history.

5. Konten tanpa approval tidak boleh masuk production.

6. Review result harus dapat diaudit.

7. Human approval menjadi keputusan final.
