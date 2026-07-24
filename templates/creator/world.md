# World Template

Version: 1.0

Template Type:

```text
Creator Template
```

Domain:

```text
Universe World
```

Workflow Position:

```text
Creator Intent

↓

World Creation

↓

World Bible

↓

AI Engine Context
```

---

# World Identity

## Basic Information

```yaml
world_id:
name:
world_type:
location_type:
era:
status:
```

Example:

```yaml
world_id: WORLD-SB-001
name:
world_type: Adventure World
location_type: Nusantara
era:
status: Active
```

---

# World Summary

## Short Description

Deskripsi singkat dunia:

```text
[World summary]
```

---

## World Purpose

Tujuan dunia ini dalam cerita:

```text
[Why this world exists in Suro & Buya universe]
```

---

# World Concept

## Core Concept

Konsep utama dunia:

```text
[Main world concept]
```

---

## Theme

Tema yang melekat pada dunia:

```text
-
-
-
```

---

## Atmosphere

Nuansa dunia:

```text
[World atmosphere]
```

Contoh:

* hangat
* penuh petualangan
* misterius
* edukatif

---

# Geographic Structure

## Region

Daftar wilayah:

```yaml
regions:

  - name:
    description:
    importance:
```

---

## Location

Lokasi penting:

```yaml
locations:

  - name:
    type:
    description:
    story_role:
```

Contoh:

```yaml
locations:

  - name:
    type: Village
    description:
    story_role: Starting point
```

---

## Map Reference

Referensi peta:

```yaml
map_assets:

  - asset_id:
    description:
```

---

# Environment

## Natural Environment

Deskripsi lingkungan alam:

```text
[Forest, mountain, ocean, river, etc.]
```

---

## Climate

Kondisi iklim:

```text
[Climate description]
```

---

## Landscape Identity

Ciri khas visual lingkungan:

```text
-
-
-
```

---

# Culture System

## Society

Struktur masyarakat:

```text
[Society description]
```

---

## Tradition

Tradisi dan kebiasaan:

```text
-
-
-
```

---

## Language

Bahasa atau gaya komunikasi:

```text
-
```

---

## Values

Nilai yang dijunjung:

```text
-
-
-
```

---

# World Rules

## Physical Rules

Aturan fisik dunia:

```text
-
-
```

---

## Social Rules

Aturan sosial:

```text
-
-
```

---

## Special Rules

Aturan khusus dunia:

```text
-
-
```

Catatan:

Aturan khusus tidak boleh bertentangan dengan Universe Bible.

---

# History

## Origin

Asal mula dunia:

```text
[World origin]
```

---

## Historical Events

Peristiwa penting:

```yaml
events:

  - name:
    period:
    description:
```

---

## Timeline Reference

Hubungan dengan timeline cerita:

```text
[Timeline relationship]
```

---

# World Inhabitants

## Population

Informasi populasi:

```yaml
population:

type:

description:
```

---

## Communities

Kelompok masyarakat:

```yaml
communities:

  - name:
    description:
    role:
```

---

## Creatures

Makhluk atau hewan penting:

```yaml
creatures:

  - name:
    description:
    role:
```

---

# World Conflict

## Existing Conflict

Konflik yang ada di dunia:

```text
-
```

---

## Threat

Ancaman:

```text
-
```

---

## Mystery

Hal yang belum diketahui:

```text
-
```

---

# World Relationship

Hubungan dunia dengan object lain:

```yaml
relationships:

  - object:
    type:
    description:
```

Contoh:

```yaml
relationships:

  - object: Suro
    type: Character Connection
    description: Home environment
```

---

# Story Usage

## Story Function

Fungsi dunia dalam cerita:

```text
-
```

---

## Possible Stories

Jenis cerita yang dapat terjadi:

```text
-
-
-
```

---

## Restricted Usage

Hal yang tidak boleh dilakukan:

```text
-
-
-
```

---

# Visual Identity

## Visual Style

Gaya visual dunia:

```text
[Visual description]
```

---

## Color Language

Palet warna:

```text
-
-
```

---

## Visual Reference

Referensi asset:

```yaml
visual_assets:

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

## Identity

* [ ] World ID tersedia
* [ ] Nama dunia tersedia
* [ ] Konsep dunia jelas

## Geography

* [ ] Region tersedia
* [ ] Location tersedia
* [ ] Environment tersedia

## Culture

* [ ] Society defined
* [ ] Tradition defined
* [ ] Values defined

## Story

* [ ] World memiliki fungsi cerita
* [ ] Conflict tersedia
* [ ] Relationship tersedia

## Canon

* [ ] Tidak bertentangan dengan World Bible
* [ ] Sesuai dengan Story Bible
* [ ] Visual sesuai Visual Bible

---

# Output

World Template menghasilkan:

```text
World Object

↓

world.schema.json

↓

World Bible Entry

↓

AI Engine Context
```

---

# Template Rules

1. World tidak boleh membuat aturan canon baru tanpa approval.

2. Geography harus konsisten dengan World Bible.

3. Culture harus sesuai tema Suro & Buya.

4. Location baru harus memiliki fungsi cerita.

5. Perubahan world harus menggunakan versioning.
