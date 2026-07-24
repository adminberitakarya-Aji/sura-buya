# Production Template

Version: 1.0

Template Type:

```text
Creator Template
```

Domain:

```text
Production Planning
```

Workflow Position:

```text
Episode Review

↓

Production Preparation

↓

Production Pipeline

↓

Final Content Output
```

---

# Production Identity

## Basic Information

```yaml
production_id:
target_type:
target_id:
production_version:
status:
created:
```

Example:

```yaml
production_id: PROD-SB-001
target_type: Episode
target_id: EP-SB-001
production_version: v1.0
status: Draft
created:
```

---

# Production Summary

## Production Purpose

Tujuan produksi:

```text
[Why this content is produced]
```

---

## Production Scope

Lingkup produksi:

```yaml
scope:

story:

episode:

scene:

visual:

audio:
```

---

# Content Reference

## Source Content

Referensi konten:

```yaml
source:

story_id:

season_id:

episode_id:

review_id:
```

---

## Approved Version

Versi yang digunakan:

```yaml
approved_version:

content_version:

review_version:
```

---

# Script Production

## Script Status

```yaml
script:

status:

version:

approved:
```

---

## Script Requirement

Kebutuhan script:

```yaml
script_requirement:

dialogue:

narration:

action:

timing:
```

---

# Scene Production

## Scene List

Daftar scene produksi:

```yaml
scenes:

- scene_id:
  title:
  duration:
  status:
```

---

## Scene Specification

Detail scene:

```yaml
scene_specification:

scene_id:

location:

characters:

action:

emotion:

visual_requirement:
```

---

# Storyboard Requirement

## Storyboard Planning

```yaml
storyboard:

required:

style:

format:

reference:
```

---

## Shot Planning

```yaml
shots:

- shot_id:
  scene_id:
  description:
  camera:
  movement:
```

---

# Visual Production

## Character Assets

Asset karakter:

```yaml
character_assets:

- asset_id:
  character:
  status:
```

---

## Environment Assets

Asset lingkungan:

```yaml
environment_assets:

- asset_id:
  location:
  status:
```

---

## Visual Style

```yaml
visual_style:

style:

color:

lighting:

reference:
```

---

# Animation Requirement

## Animation Direction

```yaml
animation:

style:

movement:

expression:

special_effect:
```

---

## Animation Notes

```text
[Animation notes]
```

---

# Voice Production

## Voice Requirement

```yaml
voice:

characters:

voice_style:

emotion:

direction:
```

---

## Dialogue Recording

```yaml
voice_recording:

status:

script_version:

take:
```

---

# Audio Production

## Music

```yaml
music:

theme:

mood:

requirement:
```

---

## Sound Effect

```yaml
sound_effect:

required:

reference:
```

---

## Ambience

```yaml
ambience:

location:

feeling:
```

---

# Localization

Jika diperlukan:

```yaml
localization:

language:

subtitle:

dub:
```

---

# Quality Assurance

## Production QA Checklist

### Story

* [ ] Menggunakan script approved
* [ ] Cerita sesuai review result

### Visual

* [ ] Character design sesuai
* [ ] Environment sesuai
* [ ] Visual style sesuai

### Audio

* [ ] Voice sesuai karakter
* [ ] Audio quality memenuhi standar

### Technical

* [ ] Asset lengkap
* [ ] File production lengkap
* [ ] Version sesuai

---

# Production Status

Lifecycle:

```text
Planning

↓

Pre Production

↓

Production

↓

Review

↓

Approved

↓

Published
```

---

# Production Timeline

```yaml
timeline:

pre_production:

production:

review:

release:
```

---

# Production Team

```yaml
team:

creator:

writer:

artist:

animator:

voice:

editor:
```

---

# Asset Reference

Semua asset produksi:

```yaml
assets:

- asset_id:
  category:
  status:
```

---

# Output Package

Production menghasilkan:

```text
Production Package

↓

Script

↓

Storyboard

↓

Visual Asset List

↓

Voice Requirement

↓

Animation Requirement

↓

Publishing Package
```

---

# Canon Reference

Hubungan dengan Universe Bible:

```yaml
universe_reference:

character_bible:

world_bible:

story_bible:

visual_bible:

production_bible:
```

---

# Engine Metadata

Digunakan AI Engine:

```yaml
metadata:

id:

version:

created:

updated:

status:

author:
```

---

# Template Rules

1. Production hanya menerima konten yang sudah approved.

2. Production tidak boleh mengubah canon cerita.

3. Semua asset harus memiliki referensi.

4. Production package harus memiliki versioning.

5. Perubahan produksi harus melalui review ulang.

6. Output production menjadi input Production Pipeline.
