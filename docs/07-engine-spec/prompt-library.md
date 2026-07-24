# 08-engine-spec/prompt-library.md

# Prompt Library Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Prompt Library adalah repository resmi seluruh prompt yang digunakan oleh AI Engine Suro & Buya.

Prompt Library memastikan bahwa seluruh runtime menggunakan prompt yang:

- konsisten
- dapat dikontrol
- dapat diuji
- dapat di-versioning
- dapat diaudit
- mengikuti Universe Bible

Prompt bukan bagian dari source code runtime.

Prompt diperlakukan sebagai aset (asset) yang dapat berkembang tanpa mengubah implementasi engine.

---

# 2. Goals

Prompt Library harus mampu:

- menyimpan seluruh prompt
- melakukan versioning prompt
- mendukung reusable prompt
- mendukung prompt composition
- mendukung template variable
- mendukung prompt inheritance
- mendukung prompt testing
- mendukung prompt optimization
- mendukung prompt traceability

---

# 3. Design Principles

## Bible First

Prompt tidak boleh meminta AI membuat informasi di luar Universe Bible.

---

## Deterministic

Prompt harus meminimalkan variasi yang tidak diperlukan.

---

## Modular

Prompt disusun dari komponen kecil yang dapat digunakan kembali.

---

## Composable

Prompt dapat digabung menjadi prompt yang lebih besar.

---

## Versioned

Setiap perubahan prompt memiliki nomor versi.

---

## Traceable

Setiap output dapat ditelusuri ke prompt yang digunakan.

---

# 4. High Level Architecture

```text
                 Prompt Library

                       │

      ┌────────────────┼────────────────┐

      │                │                │

 System Prompt   Runtime Prompt   Validator Prompt

      │                │                │

      └────────────────┼────────────────┘

                       │

               Prompt Composer

                       │

               Final Runtime Prompt
```

---

# 5. Prompt Categories

Prompt Library terdiri dari beberapa kategori.

```
System Prompt

Workflow Prompt

Retrieval Prompt

Planning Prompt

Generation Prompt

Validation Prompt

Review Prompt

Production Prompt

Utility Prompt
```

---

# 6. System Prompt

System Prompt mendefinisikan identitas AI Engine.

Contoh tanggung jawab:

- AI khusus Suro & Buya
- Bible First
- Canon First
- Tidak membuat fakta baru
- Mengikuti seluruh aturan engine

System Prompt digunakan pada seluruh workflow.

---

# 7. Workflow Prompt

Workflow Prompt menjelaskan tujuan runtime.

Contoh:

```
Episode Planning

↓

Bangun Planning Blueprint
```

atau

```
Dialogue Generation

↓

Bangun dialog
berdasarkan Character Bible
```

---

# 8. Retrieval Prompt

Digunakan untuk membantu Retrieval Runtime.

Contoh tugas:

- menentukan query
- menentukan referensi
- memilih context
- menyusun retrieval result

Prompt ini tidak menghasilkan cerita.

---

# 9. Planning Prompt

Planning Prompt membantu:

- Story Planning
- Episode Planning
- Scene Planning
- Conflict Planning
- Character Planning

Output:

Planning Blueprint.

---

# 10. Generation Prompt

Generation Prompt digunakan untuk:

- Scene Generation
- Dialogue Generation
- Narrative Generation
- Visual Description

Generation Prompt selalu menerima:

- Planning Blueprint
- Working Context
- Canon Rules

---

# 11. Validation Prompt

Validation Prompt digunakan untuk:

- Canon Checking
- Character Checking
- Timeline Checking
- Dialogue Checking
- Visual Checking

Output:

Validation Report.

---

# 12. Review Prompt

Review Prompt digunakan untuk:

- Story Review
- Character Review
- Dialogue Review
- Quality Review
- Production Readiness

Output:

Review Package.

---

# 13. Production Prompt

Production Prompt digunakan untuk:

- Script Packaging
- Manifest Generation
- Metadata Generation
- Asset Packaging

Prompt ini tidak menghasilkan konten cerita baru.

---

# 14. Utility Prompt

Prompt utilitas.

Contoh:

- Summarization
- Context Compression
- Context Expansion
- Classification
- Translation (jika diperlukan)
- Metadata Generation

---

# 15. Prompt Composition

Prompt dibangun dari beberapa bagian.

```text
System Prompt

+

Runtime Prompt

+

Bible Context

+

Working Context

+

Runtime Configuration

↓

Final Prompt
```

Prompt Composer bertanggung jawab menyusun urutan tersebut.

---

# 16. Prompt Template

Prompt menggunakan template.

Contoh:

```text
{{SYSTEM}}

{{GOAL}}

{{CANON}}

{{PLANNING}}

{{CONTEXT}}

{{RULES}}

{{OUTPUT_FORMAT}}
```

Runtime hanya mengisi variabel.

---

# 17. Prompt Variables

Variabel yang umum digunakan:

- Intent
- Goal
- Story Bible
- Character Bible
- World Bible
- Season Bible
- Episode History
- Planning Blueprint
- Scene Plan
- Character List
- Runtime Configuration

---

# 18. Prompt Constraints

Seluruh prompt wajib memuat batasan berikut.

AI tidak boleh:

- membuat canon baru
- mengubah timeline
- mengubah karakter
- mengubah aturan dunia
- mengubah hubungan karakter
- mengabaikan Planning Blueprint
- mengabaikan Validation Feedback

---

# 19. Prompt Output Contract

Setiap prompt memiliki output yang terstruktur.

Contoh:

```text
Status

Result

References

Warnings

Metadata
```

Output bebas tidak diperbolehkan.

---

# 20. Prompt Versioning

Contoh:

```
Generation Prompt

v1.0.0
```

↓

```
v1.0.1
```

↓

```
v1.1.0
```

Semua versi tetap disimpan.

---

# 21. Prompt Testing

Setiap prompt harus dapat diuji.

Contoh pengujian:

- Canon Test
- Character Test
- Dialogue Test
- Regression Test
- Output Format Test
- Token Usage Test

Prompt baru tidak boleh digunakan sebelum lolos pengujian.

---

# 22. Prompt Optimization

Prompt dapat dioptimalkan berdasarkan:

- token usage
- kualitas output
- konsistensi
- waktu eksekusi

Optimisasi tidak boleh mengubah perilaku utama engine tanpa proses versioning.

---

# 23. Prompt Repository Structure

Contoh struktur:

```text
prompt-library/

system/

workflow/

retrieval/

planning/

generation/

validation/

review/

production/

utility/

templates/
```

---

# 24. Prompt Metadata

Setiap prompt memiliki metadata.

Contoh:

```text
Prompt ID

Name

Version

Runtime

Author

Created Date

Updated Date

Dependencies

Status
```

---

# 25. Prompt Traceability

Setiap output AI harus menyimpan:

```text
Prompt ID

↓

Prompt Version

↓

Runtime

↓

Execution ID
```

Dengan demikian setiap hasil dapat direproduksi menggunakan prompt yang sama.

---

# 26. Canon Enforcement

Prompt Library merupakan lapisan pertama pengendali perilaku model.

Seluruh prompt wajib menegaskan bahwa AI:

- hanya menggunakan informasi dari Universe Bible
- tidak mengarang fakta baru
- tidak mengubah canon
- tidak mengubah identitas karakter
- tidak mengubah timeline
- tidak mengubah aturan dunia
- harus mengembalikan hasil sesuai kontrak output

Dengan demikian, kepatuhan terhadap canon dimulai sejak instruksi diberikan kepada model, bukan hanya pada tahap Validation Runtime.

---

# 27. Relationship with Other Components

| Component | Interaksi |
|-----------|-----------|
| Orchestrator | Memilih prompt sesuai workflow |
| Retrieval Runtime | Menggunakan Retrieval Prompt |
| Planning Runtime | Menggunakan Planning Prompt |
| Generation Runtime | Menggunakan Generation Prompt |
| Validation Runtime | Menggunakan Validation Prompt |
| Review Runtime | Menggunakan Review Prompt |
| Production Runtime | Menggunakan Production Prompt |
| Memory Runtime | Menyediakan variabel context untuk template |

Prompt Library tidak dipanggil langsung oleh Creator, tetapi oleh Orchestrator melalui runtime yang sesuai.

---

# 28. Success Criteria

Prompt Library dianggap berhasil apabila:

- seluruh runtime memiliki prompt resmi
- prompt bersifat modular dan reusable
- seluruh prompt memiliki versi
- template dan variabel terstandarisasi
- output mengikuti kontrak yang ditentukan
- seluruh prompt dapat diuji
- seluruh prompt dapat ditelusuri
- seluruh prompt menjaga kepatuhan terhadap Universe Bible

---

# 29. Summary

Prompt Library adalah repository resmi instruksi AI Engine Suro & Buya.

Dengan memisahkan prompt dari implementasi runtime, engine memperoleh fleksibilitas untuk mengembangkan kualitas AI tanpa mengubah arsitektur inti. Seluruh prompt dikelola sebagai aset yang terversi, dapat diuji, dapat diaudit, dan selalu berlandaskan Universe Bible sehingga setiap proses retrieval, planning, generation, validation, review, dan production menghasilkan output yang konsisten dan dapat dipertanggungjawabkan.