# Episode Template

Version: 1.0

Template Type:

```text
Creator Template
```

Domain:

```text
Episode Production Planning
```

Workflow Position:

```text
Creator Intent

↓

Season Planning

↓

Episode Planning

↓

Scene Planning

↓

Dialogue Generation

↓

Production Package
```

---

# Episode Identity

## Basic Information

```yaml
episode_id:
season_id:
story_id:
episode_number:
title:
episode_type:
status:
```

Example:

```yaml
episode_id: EP-SB-001
season_id: SEASON-SB-001
story_id: STORY-SB-001
episode_number: 1
title:
episode_type: Adventure Episode
status: Draft
```

---

# Episode Summary

## Episode Logline

Ringkasan inti episode dalam satu kalimat:

```text
[Episode premise]
```

---

## Episode Synopsis

Ringkasan keseluruhan episode:

```text
[Episode summary]
```

---

## Episode Purpose

Tujuan episode:

```text
[Why this episode exists]
```

Contoh:

* memperkenalkan karakter baru,
* menyelesaikan konflik kecil,
* memperkenalkan nilai pembelajaran.

---

# Season Connection

## Season Position

Posisi episode dalam season:

```yaml
season_position:

episode_role:

arc_position:

importance:
```

Contoh:

```yaml
season_position:

episode_role: Introduction

arc_position: Beginning

importance: High
```

---

## Previous Episode Connection

Hubungan dengan episode sebelumnya:

```yaml
previous_connection:

episode_id:

continuity:
```

---

## Next Episode Setup

Persiapan episode berikutnya:

```yaml
next_setup:

future_hook:

related_episode:
```

---

# Episode Narrative Structure

## Episode Structure

Struktur utama:

```yaml
episode_structure:

opening:

development:

climax:

ending:
```

---

# Story Objective

## Main Objective

Tujuan utama cerita:

```text
[Main objective]
```

---

## Secondary Objectives

Tujuan tambahan:

```yaml
secondary_objectives:

-
-
-
```

---

# Conflict Design

## Main Conflict

Konflik utama episode:

```text
[Main conflict]
```

---

## Challenge

Tantangan yang dihadapi karakter:

```yaml
challenges:

-
-
-
```

---

## Resolution

Penyelesaian konflik:

```text
[Conflict resolution]
```

---

# Character Usage

## Character Appearance

Daftar karakter yang muncul:

```yaml
characters:

- character_id:
  role:
  importance:
```

---

## Character Goal

Tujuan karakter dalam episode:

```yaml
character_goals:

- character_id:
  goal:
```

---

## Character Development

Perubahan karakter:

```yaml
character_development:

- character_id:
  change:
```

---

# Scene Planning

## Scene List

Daftar scene:

```yaml
scenes:

- scene_id:
  title:
  purpose:
  location:
  characters:
  duration:
```

Contoh:

```yaml
scenes:

- scene_id: SC-001
  title:
  purpose:
  location:
  characters:
  duration:
```

---

# Scene Flow

Hubungan antar scene:

```text
Scene 01

↓

Scene 02

↓

Scene 03

↓

Resolution
```

---

# Scene Requirements

Setiap scene harus memiliki:

```yaml
scene_requirements:

visual:

dialogue:

action:

emotion:
```

---

# Dialogue Planning

## Dialogue Purpose

Tujuan dialog:

```text
[Dialogue intention]
```

---

## Key Dialogue Moments

Momen dialog penting:

```yaml
dialogue_moments:

- character:
  purpose:
  emotional_state:
```

---

## Character Voice Rules

Aturan suara karakter:

```yaml
voice_rules:

- character_id:
  rule:
```

---

# Emotional Design

## Episode Emotion Arc

Perjalanan emosi:

```text
Beginning:

Middle:

Ending:
```

---

## Emotional Beats

Momen emosi:

```yaml
emotional_beats:

- moment:
  emotion:
  purpose:
```

---

# Educational Element

Khusus serial anak.

## Learning Objective

Pembelajaran episode:

```text
-
```

---

## Moral Value

Nilai yang dibangun:

```text
-
-
```

---

# World Usage

## Locations

Lokasi episode:

```yaml
locations:

- location_id:
  purpose:
```

---

## World Rules Applied

Aturan dunia yang digunakan:

```yaml
world_rules:

-
-
```

---

# Visual Direction

## Episode Visual Concept

Konsep visual:

```text
[Visual direction]
```

---

## Key Shots

Adegan visual penting:

```yaml
key_visuals:

- scene_id:
  description:
```

---

## Asset Requirement

Asset yang diperlukan:

```yaml
assets:

- asset_id:
  type:
  requirement:
```

---

# Production Requirement

## Animation Requirement

```yaml
animation:

style:

movement:

special_requirement:
```

---

## Voice Requirement

```yaml
voice:

characters:

emotion:

direction:
```

---

## Audio Requirement

```yaml
audio:

music:

sound_effect:

ambience:
```

---

# Review Criteria

## Story Quality

* [ ] Episode memiliki tujuan jelas
* [ ] Konflik memiliki resolusi
* [ ] Ending sesuai tujuan episode

## Character

* [ ] Karakter konsisten
* [ ] Dialog sesuai personality

## Continuity

* [ ] Sesuai Season Arc
* [ ] Tidak melanggar Story Bible

## Production

* [ ] Scene lengkap
* [ ] Asset requirement jelas

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

# Output

Episode Template menghasilkan:

```text
Episode Object

↓

episode.schema.json

↓

Episode Plan

↓

Scene Generator Input

↓

Dialogue Generator Input

↓

Production Package
```

---

# Template Rules

1. Episode harus memiliki parent Season yang valid.

2. Episode tidak boleh membuat canon baru.

3. Semua karakter harus berasal dari Character Bible.

4. Semua lokasi harus berasal dari World Bible.

5. Episode harus mengikuti Season Arc.

6. Setiap episode harus memiliki tujuan dan resolusi.

7. Perubahan episode harus menggunakan versioning.
