# Story Template

Version: 1.0

Template Type:

```text
Creator Template
```

Domain:

```text
Universe Story
```

Workflow Position:

```text
Creator Intent

↓

Story Creation

↓

Story Bible

↓

Season Planning

↓

AI Engine Planning Context
```

---

# Story Identity

## Basic Information

```yaml
story_id:
title:
story_type:
genre:
target_audience:
status:
```

Example:

```yaml
story_id: STORY-SB-001
title:
story_type: Adventure Series
genre:
target_audience:
status: Active
```

---

# Story Summary

## Logline

Satu kalimat inti cerita:

```text
[Main story premise in one sentence]
```

---

## Short Synopsis

Ringkasan cerita:

```text
[Story summary]
```

---

## Story Purpose

Tujuan utama cerita:

```text
[Why this story exists]
```

---

# Story Concept

## Core Idea

Ide utama cerita:

```text
[Main narrative concept]
```

---

## Theme

Tema utama:

```text
-
-
-
```

Contoh:

* persahabatan
* keberanian
* rasa ingin tahu
* menjaga alam

---

## Message

Pesan yang ingin disampaikan:

```text
-
-
```

---

# Narrative Structure

## Story Type

Jenis cerita:

```text
[Adventure / Mystery / Educational / Comedy / etc.]
```

---

## Narrative Format

Format penyampaian:

```yaml
format:
episode_based:
serial_arc:
standalone:
```

---

## Story Arc

Struktur perkembangan cerita:

```yaml
story_arc:

beginning:

middle:

ending:
```

---

# Story World Connection

## Setting

Hubungan cerita dengan dunia:

```text
[Where and when story happens]
```

---

## Important Locations

Lokasi yang digunakan:

```yaml
locations:

- name:
  purpose:
  importance:
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

# Character Involvement

## Main Characters

Karakter utama:

```yaml
main_characters:

- character_id:
  role:
  objective:
```

---

## Supporting Characters

Karakter pendukung:

```yaml
supporting_characters:

- character_id:
  role:
```

---

## Character Dynamics

Hubungan antar karakter:

```text
[Relationship description]
```

---

# Story Conflict

## Main Conflict

Konflik utama:

```text
[Central conflict]
```

---

## Internal Conflict

Konflik dalam karakter:

```text
[Character emotional conflict]
```

---

## External Conflict

Konflik dari luar:

```text
[External challenge]
```

---

# Story Objectives

## Main Goal

Tujuan utama cerita:

```text
[Main objective]
```

---

## Character Goals

Tujuan karakter:

```yaml
character_goals:

- character:
  goal:
```

---

## Stakes

Hal yang dipertaruhkan:

```text
-
-
```

---

# Story Progression

## Beginning State

Kondisi awal:

```text
[Starting situation]
```

---

## Development

Perkembangan cerita:

```text
[Story progression]
```

---

## Resolution

Penyelesaian:

```text
[Ending resolution]
```

---

# Episode Structure Reference

Digunakan jika cerita berbentuk serial.

```yaml
episode_structure:

season:

episodes:

arc:
```

---

# Story Beats

Urutan beat utama:

```yaml
story_beats:

- beat:
  description:
  purpose:
```

Contoh:

```yaml
story_beats:

- beat: Discovery
  description:
  purpose: Introduce adventure
```

---

# Emotional Design

## Emotional Journey

Perjalanan emosi cerita:

```text
[Beginning emotion → Ending emotion]
```

---

## Key Emotional Moments

Momen penting:

```yaml
emotional_moments:

- moment:
  emotion:
  purpose:
```

---

# Educational Element

Khusus untuk serial anak.

## Learning Objective

Nilai atau pembelajaran:

```text
-
```

---

## Knowledge Element

Pengetahuan yang diperkenalkan:

```text
-
```

---

# Story Constraints

## Must Include

Elemen wajib:

```text
-
-
-
```

---

## Must Avoid

Elemen yang dilarang:

```text
-
-
-
```

---

## Tone Rules

Aturan tone:

```text
-
-
```

---

# Visual Direction

## Visual Concept

Konsep visual cerita:

```text
[Visual direction]
```

---

## Key Visual Moments

Adegan visual penting:

```yaml
visual_moments:

- scene:
  description:
```

---

# Asset Reference

Hubungan dengan assets:

```yaml
assets:

story_assets:

- asset_id:
  type:
  description:
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

# Validation Checklist

## Story Identity

* [ ] Story ID tersedia
* [ ] Title tersedia
* [ ] Story purpose jelas

## Narrative

* [ ] Premise jelas
* [ ] Theme jelas
* [ ] Conflict tersedia
* [ ] Resolution tersedia

## Character

* [ ] Character involvement jelas
* [ ] Character goal tersedia

## World

* [ ] Setting sesuai World Bible
* [ ] Location valid

## Production

* [ ] Story dapat dikembangkan menjadi episode
* [ ] Visual direction tersedia

## Canon

* [ ] Tidak bertentangan dengan Story Bible
* [ ] Sesuai Character Bible
* [ ] Sesuai World Bible

---

# Output

Story Template menghasilkan:

```text
Story Object

↓

story.schema.json

↓

Story Bible Entry

↓

Season Planner Input

↓

Episode Generation Context
```

---

# Template Rules

1. Story tidak boleh membuat canon baru di luar Universe Bible.

2. Story harus menggunakan karakter dan dunia yang valid.

3. Konflik harus sesuai target audience Suro & Buya.

4. Story harus memiliki tujuan naratif yang jelas.

5. Setiap perubahan story harus menggunakan versioning.
