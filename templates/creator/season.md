# Season Template

Version: 1.0

Template Type:

```text
Creator Template
```

Domain:

```text
Universe Story / Series Planning
```

Workflow Position:

```text
Creator Intent

↓

Story Creation

↓

Season Planning

↓

Episode Planning

↓

AI Engine Planning Context
```

---

# Season Identity

## Basic Information

```yaml
season_id:
story_id:
title:
season_number:
season_type:
status:
```

Example:

```yaml
season_id: SEASON-SB-001
story_id: STORY-SB-001
title:
season_number: 1
season_type: Main Season
status: Active
```

---

# Season Summary

## Season Logline

Ringkasan satu kalimat:

```text
[Main season premise]
```

---

## Season Synopsis

Ringkasan keseluruhan musim:

```text
[Season summary]
```

---

## Season Purpose

Tujuan musim ini:

```text
[Why this season exists]
```

---

# Story Connection

## Parent Story

Referensi cerita induk:

```yaml
parent_story:

story_id:

relationship:
```

---

## Story Arc Position

Posisi season dalam keseluruhan cerita:

```yaml
story_arc_position:

beginning:

middle:

ending:
```

---

# Season Concept

## Core Theme

Tema utama season:

```text
-
-
-
```

---

## Season Message

Pesan yang ingin disampaikan:

```text
-
-
```

---

## Emotional Direction

Arah emosi season:

```text
Beginning:

Development:

Ending:
```

---

# Season Narrative Structure

## Season Arc

Struktur besar season:

```yaml
season_arc:

setup:

rising_action:

climax:

resolution:
```

---

## Major Story Beats

Daftar peristiwa utama:

```yaml
major_beats:

- beat:
  description:
  episode_range:
  importance:
```

Contoh:

```yaml
major_beats:

- beat: Discovery
  description:
  episode_range: 1-3
  importance: High
```

---

# Episode Planning

## Episode Count

Jumlah episode:

```yaml
episode_count:
```

---

## Episode List

Daftar episode:

```yaml
episodes:

- episode_id:
  title:
  objective:
  status:
```

---

Contoh:

```yaml
episodes:

- episode_id: EP-SB-001
  title:
  objective:
  status: Planned
```

---

# Episode Progression

## Episode Relationship

Hubungan antar episode:

```text
[How episodes connect]
```

---

## Continuity Rules

Aturan kesinambungan:

```yaml
continuity_rules:

-
-
-
```

---

# Character Development

## Character Arc

Perkembangan karakter utama:

```yaml
character_arcs:

- character_id:
  starting_state:
  development:
  ending_state:
```

---

## Character Focus

Distribusi fokus karakter:

```yaml
character_focus:

- character_id:
  episode_range:
  purpose:
```

---

# World Expansion

## New World Elements

Elemen dunia baru:

```yaml
world_expansion:

- element:
  description:
  introduced_episode:
```

---

## Location Usage

Penggunaan lokasi:

```yaml
locations:

- location:
  episode:
  purpose:
```

---

# Conflict Management

## Season Conflict

Konflik utama season:

```text
[Main season conflict]
```

---

## Episode Conflicts

Konflik per episode:

```yaml
episode_conflicts:

- episode_id:
  conflict:
```

---

# Educational Design

Khusus Suro & Buya sebagai serial anak.

## Learning Goals

Tujuan pembelajaran season:

```text
-
-
```

---

## Values

Nilai yang dibangun:

```text
-
-
-
```

---

# Visual Direction

## Season Visual Theme

Tema visual:

```text
[Visual identity]
```

---

## Recurring Visual Elements

Elemen visual berulang:

```yaml
visual_elements:

-
-
-
```

---

## Asset Reference

```yaml
assets:

- asset_id:
  type:
  description:
```

---

# Production Planning Reference

## Production Requirements

Kebutuhan produksi:

```yaml
production_requirements:

animation:

voice:

music:

asset:
```

---

## Production Notes

Catatan produksi:

```text
-
-
```

---

# Review Criteria

Season dinilai berdasarkan:

## Narrative Quality

* [ ] Season memiliki tujuan jelas
* [ ] Arc berkembang
* [ ] Ending memberikan resolusi

## Character

* [ ] Character development konsisten
* [ ] Relationship berkembang

## World

* [ ] World expansion valid
* [ ] Tidak melanggar World Bible

## Production

* [ ] Episode dapat diproduksi
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

Season Template menghasilkan:

```text
Season Object

↓

season.schema.json

↓

Season Bible Entry

↓

Episode Planner Input

↓

Production Planning Context
```

---

# Template Rules

1. Season harus memiliki parent Story yang valid.

2. Season tidak boleh mengubah canon karakter.

3. Episode harus mengikuti season arc.

4. Character development harus konsisten dengan Character Bible.

5. Setiap season harus memiliki tujuan naratif yang jelas.

6. Perubahan season harus menggunakan versioning.
