# Production Template

Version: 1.0

Template Type:

```text id="r8f3zw"
Engine Template
```

Domain:

```text id="n2y7qm"
AI Production Runtime
```

Workflow Position:

```text id="k5d9xp"
Review Runtime

↓

Production Runtime

↓

Production Package

↓

Execution Pipeline

↓

Publishing
```

---

# Production Identity

## Basic Information

```yaml id="3j8f0v"
production_id:
request_id:
review_id:
target_type:
target_id:
production_type:
status:
created:
updated:
```

Example:

```yaml id="q7w4tz"
production_id: PROD-ENGINE-SB-001
request_id: REQ-SB-001
review_id: REVIEW-SB-001
target_type: Episode
target_id: EP-SB-001
production_type: Episode Production Package
status: Preparing
```

---

# Production Purpose

## Objective

Tujuan production package:

```text id="x9p2mc"
[Why this production package is created]
```

Contoh:

* menyiapkan episode untuk produksi,
* menghubungkan script dengan asset,
* membuat instruction untuk production pipeline.

---

# Production Source

Referensi sumber:

```yaml id="k4v8hn"
source:

story_id:

season_id:

episode_id:

review_id:

validation_id:
```

---

# Production Approval

Status approval:

```yaml id="m5n1qh"
approval:

review_status:

approved:

approved_by:

approved_date:
```

---

# Production Package

Output yang harus tersedia:

```yaml id="p8t3sd"
package:

script:

storyboard:

visual:

voice:

audio:

assets:

metadata:
```

---

# Script Package

## Script Reference

```yaml id="w6c4jr"
script:

source:

version:

format:

status:
```

---

## Script Components

```yaml id="h7z2mb"
components:

dialogue:

narration:

action:

timing:

scene_reference:
```

---

# Scene Production Data

## Scene Package

```yaml id="f5y8qx"
scenes:

- scene_id:
  order:
  duration:
  location:
  characters:
  action:
  emotion:
```

---

## Scene Status

```yaml id="b2n9lc"
scene_status:

planned:

ready:

completed:
```

---

# Storyboard Package

## Storyboard Data

```yaml id="u3m6pk"
storyboard:

format:

version:

scenes:

shots:
```

---

## Shot Specification

```yaml id="c8r4yn"
shots:

- shot_id:
  scene_id:
  description:
  camera:
  movement:
  visual_focus:
```

---

# Visual Production Package

## Character Assets

```yaml id="s9d1fv"
characters:

- character_id:
  asset_reference:
  version:
```

---

## Environment Assets

```yaml id="j6q0wd"
environments:

- location_id:
  asset_reference:
  version:
```

---

## Visual Generation Instruction

Instruksi visual:

```yaml id="e4k7hp"
visual_instruction:

style:

composition:

lighting:

restriction:
```

---

# Voice Production Package

## Voice Requirement

```yaml id="z5w8qa"
voice:

characters:

- character_id:
  voice_profile:
  emotion:
  direction:
```

---

## Dialogue Recording Data

```yaml id="n3r6xm"
recording:

script_version:

language:

take_requirement:

quality_standard:
```

---

# Audio Production Package

## Music

```yaml id="v8m1dy"
music:

mood:

theme:

reference:
```

---

## Sound Effect

```yaml id="q6f9bt"
sound_effect:

required:

scene_reference:
```

---

## Environment Sound

```yaml id="s2h5pk"
ambience:

location:

description:
```

---

# Asset Dependency

Semua asset yang diperlukan:

```yaml id="r7x3nc"
asset_dependencies:

- asset_id:
  type:
  source:
  status:
  required:
```

---

# Execution Instruction

Instruksi untuk Production Runtime:

```yaml id="y4k8mw"
execution:

workflow:

steps:

priority:

parallel_tasks:
```

---

Contoh:

```yaml id="z8c1qp"
execution:

workflow: Episode Production Workflow

steps:

- Generate storyboard
- Prepare visual assets
- Generate voice
- Assemble package
```

---

# Quality Gate

Sebelum execution:

```yaml id="a9v5hx"
quality_gate:

script_ready:

asset_ready:

visual_ready:

audio_ready:

approval_ready:
```

---

# Production Status

Lifecycle:

```text id="w3n7kc"
Preparing

↓

Ready

↓

Executing

↓

Quality Check

↓

Completed

↓

Published
```

---

# Production Tracking

```yaml id="m9q4fz"
tracking:

progress:

current_step:

completed_steps:

blocked_reason:
```

---

# Production History

```yaml id="x1c6vb"
history:

- version:
  change:
  date:
  actor:
```

---

# Production Metadata

```yaml id="p7s2dk"
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

Production Template menghasilkan:

```text id="d8m5qh"
Production Object

↓

production.schema.json

↓

Production Package

↓

Execution Runtime

↓

Publishing Pipeline
```

---

# Template Rules

1. Production hanya menerima object yang sudah approved.

2. Production tidak boleh mengubah cerita atau canon.

3. Semua dependency harus tercatat.

4. Semua asset harus memiliki reference.

5. Production package harus reproducible.

6. Execution hanya berjalan jika quality gate terpenuhi.

7. Semua perubahan harus menggunakan version history.
