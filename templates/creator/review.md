# Review Template

Version: 1.0

Template Type:

```text id="0v0b6a"
Creator Template
```

Domain:

```text id="3y3v7g"
Content Review & Validation
```

Workflow Position:

```text id="g2cn3j"
Episode Creation

↓

Review Process

↓

Canon Validation

↓

Production Approval
```

---

# Review Identity

## Basic Information

```yaml id="xq5q48"
review_id:
target_type:
target_id:
review_type:
review_status:
created:
```

Example:

```yaml id="q3vxg0"
review_id: REVIEW-SB-001
target_type: Episode
target_id: EP-SB-001
review_type: Creative Review
review_status: Draft
created:
```

---

# Review Target

## Target Object

Objek yang direview:

```yaml id="5q5d4m"
target:

type:

id:

version:
```

Contoh:

```yaml id="5cmlhc"
target:

type: Episode

id: EP-SB-001

version: v1.0
```

---

# Review Purpose

Tujuan review:

```text id="4u7h8v"
[Why this review is performed]
```

Contoh:

* memastikan cerita konsisten,
* memastikan kualitas episode,
* persiapan produksi.

---

# Review Scope

Area yang diperiksa:

```yaml id="od4r9m"
scope:

story:

character:

world:

visual:

production:
```

---

# Canon Validation

## Universe Bible Check

Status pemeriksaan:

```yaml id="w0g4j4"
universe_validation:

character_bible:

world_bible:

story_bible:

visual_bible:

production_bible:
```

---

## Canon Issues

Temuan konflik canon:

```yaml id="8z4z2m"
canon_issues:

- issue:
  reference:
  severity:
  resolution:
```

Contoh:

```yaml id="5kjb8a"
canon_issues:

- issue:
  reference: Character Bible
  severity: High
  resolution:
```

---

# Story Review

## Narrative Quality

Penilaian cerita:

```yaml id="y3d5cq"
narrative:

structure:

pacing:

conflict:

resolution:
```

---

## Story Issues

Masalah cerita:

```yaml id="t5xk4q"
story_issues:

-

-
```

---

## Improvement Notes

Saran perbaikan:

```text id="v8i4fk"
-
-
```

---

# Character Review

## Character Consistency

Pemeriksaan karakter:

```yaml id="l6i6w5"
character_review:

personality:

behavior:

dialogue:

development:
```

---

## Character Issues

```yaml id="4h5s7k"
character_issues:

- character_id:

  issue:

  suggestion:
```

---

# World Review

## World Consistency

Pemeriksaan dunia:

```yaml id="8hm2pi"
world_review:

location:

rules:

culture:

environment:
```

---

## World Issues

```yaml id="0o8p2s"
world_issues:

-

-
```

---

# Visual Review

## Visual Consistency

Pemeriksaan visual:

```yaml id="s4t6q1"
visual_review:

style:

character_design:

environment:

asset:
```

---

## Visual Issues

```yaml id="3ksm6m"
visual_issues:

-

-
```

---

# Production Review

## Production Readiness

Pemeriksaan kesiapan produksi:

```yaml id="p3q5bk"
production_review:

scene:

asset_requirement:

voice:

audio:

animation:
```

---

## Production Issues

```yaml id="c4d6z9"
production_issues:

-

-
```

---

# Quality Score

Penilaian kualitas:

```yaml id="0x8f9m"
score:

story:

character:

world:

visual:

production:

overall:
```

---

# Review Decision

## Decision Status

```yaml id="g1q8hy"
decision:

status:

approved_by:

date:

notes:
```

Status:

```text id="b7m4i6"
Draft

↓

Need Revision

↓

Approved

↓

Rejected
```

---

# Revision Tracking

## Revision Request

Jika membutuhkan revisi:

```yaml id="7sm4n9"
revision:

required:

items:

deadline:
```

---

## Revision History

```yaml id="z9f4jx"
history:

- version:
  change:
  date:
  author:
```

---

# Approval

## Approval Checklist

### Canon

* [ ] Sesuai Character Bible
* [ ] Sesuai World Bible
* [ ] Sesuai Story Bible
* [ ] Sesuai Visual Bible

### Creative

* [ ] Cerita memiliki tujuan jelas
* [ ] Karakter konsisten
* [ ] Konflik terselesaikan

### Production

* [ ] Scene siap diproduksi
* [ ] Asset tersedia
* [ ] Requirement lengkap

---

# Asset Reference

Asset yang digunakan dalam review:

```yaml id="z2k7pi"
assets:

- asset_id:
  type:
  status:
```

---

# Engine Metadata

Digunakan AI Engine:

```yaml id="m6m1sk"
metadata:

id:

version:

created:

updated:

status:

author:
```

---

# Output

Review Template menghasilkan:

```text id="g2t1jn"
Review Object

↓

review.schema.json

↓

Validation Result

↓

Approval Decision

↓

Production Gate
```

---

# Template Rules

1. Semua konten harus melalui review sebelum production.

2. Review tidak boleh mengubah canon.

3. Semua masalah harus memiliki referensi yang jelas.

4. Approval harus tercatat.

5. Revisi harus menggunakan version history.

6. Review result menjadi input Validation Runtime.
