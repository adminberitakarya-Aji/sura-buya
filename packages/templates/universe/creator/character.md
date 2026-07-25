# Character Template

Version: 1.0

Template Type:

```
Creator Template
```

Domain:

```
Universe Character
```

Workflow Position:

```
Creator Intent

↓

Character Creation

↓

Character Bible

↓

AI Engine Context
```

---

# Character Identity

## Basic Information

```yaml
character_id:
name:
full_name:
nickname:
role:
character_type:
status:
```

Example:

```yaml
character_id: CHAR-SB-001
name: Suro
full_name:
nickname:
role: Main Character
character_type: Child Explorer
status: Active
```

---

# Character Summary

## Short Description

Tuliskan deskripsi singkat karakter.

```
[Character summary]
```

---

## Character Purpose

Peran karakter dalam cerita:

```
[Why this character exists in the story]
```

---

# Personality Profile

## Core Personality

Daftar sifat utama:

```
- 
-
-
```

---

## Strength

Kelebihan karakter:

```
-
-
-
```

---

## Weakness

Kelemahan karakter:

```
-
-
-
```

---

## Fear

Hal yang ditakuti karakter:

```
-
```

---

## Motivation

Hal yang mendorong karakter:

```
-
```

---

## Habit

Kebiasaan karakter:

```
-
-
-
```

---

# Character Behavior

## Normal Behavior

Bagaimana karakter bertindak dalam kondisi normal:

```
[Behavior description]
```

---

## Under Pressure

Bagaimana karakter bertindak ketika menghadapi masalah:

```
[Pressure behavior]
```

---

## Emotional Pattern

Pola emosi karakter:

```
Emotion:

Reaction:

Recovery:
```

---

# Character Appearance

## Physical Description

```yaml
age:
gender:
height:
body_type:
face_description:
hair:
eyes:
skin:
```

---

## Clothing

Deskripsi pakaian:

```
[Clothing description]
```

---

## Visual Identifier

Ciri visual yang mudah dikenali:

```
-
-
-
```

---

# Character Background

## Origin

Asal karakter:

```
[Origin story]
```

---

## Family

Hubungan keluarga:

```
-
-
```

---

## History

Riwayat penting:

```
-
-
-
```

---

# Character Relationship

Format:

```yaml
relationships:

  - character:
    relationship:
    description:
```

Example:

```yaml
relationships:

  - character: Buya
    relationship: Friend
    description: Partner dalam petualangan
```

---

# Character Knowledge

## Known Facts

Fakta yang diketahui karakter:

```
-
-
```

---

## Hidden Information

Informasi yang belum diketahui:

```
-
-
```

Catatan:

Hidden information harus sesuai Story Bible.

---

# Character Development

## Starting State

Kondisi awal karakter:

```
[Beginning state]
```

---

## Growth Direction

Perkembangan karakter:

```
[Character arc]
```

---

## End State

Kondisi tujuan karakter:

```
[Future state]
```

---

# Character Rules

## Must Always

Hal yang wajib konsisten:

```
-
-
-
```

---

## Must Never

Hal yang tidak boleh dilakukan:

```
-
-
-
```

---

# Character Voice

## Speaking Style

Cara berbicara:

```
[Speech style]
```

---

## Vocabulary

Kata atau gaya bahasa khas:

```
-
-
```

---

## Dialogue Example

Contoh dialog karakter:

```
Character:

"Example dialogue"
```

---

# Character Visual Reference

Asset reference:

```yaml
visual_assets:

  - asset_id:
    type:
    description:
```

Contoh:

```yaml
visual_assets:

  - asset_id: AST-CHAR-SURO-001
    type: character-sheet
    description: Suro main reference
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

Sebelum karakter diterima:

## Identity

* [ ] Character ID tersedia
* [ ] Nama karakter tersedia
* [ ] Peran karakter jelas

## Personality

* [ ] Personality defined
* [ ] Motivation defined
* [ ] Weakness defined

## Story

* [ ] Background tersedia
* [ ] Relationship tersedia
* [ ] Character arc tersedia

## Visual

* [ ] Appearance tersedia
* [ ] Visual reference tersedia

## Canon

* [ ] Tidak bertentangan dengan Character Bible
* [ ] Sudah melalui validation

---

# Output

Character Template menghasilkan:

```text
Character Object

↓

character.schema.json

↓

Character Bible Entry

↓

AI Engine Memory
```

---

# Template Rules

1. Jangan membuat karakter di luar Universe Bible tanpa approval.

2. Character personality harus konsisten dengan Story Bible.

3. Visual description harus konsisten dengan Visual Bible.

4. Relationship harus mengikuti canon relationship.

5. Setiap perubahan karakter harus menggunakan versioning.
