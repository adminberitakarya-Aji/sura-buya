# 08-engine-spec/validation-runtime.md

# Validation Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Validation Runtime bertanggung jawab memastikan bahwa seluruh output AI Engine memenuhi aturan Universe Bible sebelum diteruskan ke tahap berikutnya.

Validation Runtime merupakan **quality gate** utama dalam pipeline AI Engine.

Tidak ada hasil generation yang boleh diteruskan ke Review maupun Production tanpa melewati Validation Runtime.

Validation Runtime **tidak menghasilkan konten baru**.

Validation Runtime hanya:

- memeriksa
- membandingkan
- mendeteksi pelanggaran
- memberikan laporan
- menentukan apakah output layak diteruskan atau harus diregenerasi

---

# 2. Goals

Validation Runtime harus mampu:

- memvalidasi canon
- memvalidasi karakter
- memvalidasi timeline
- memvalidasi world rules
- memvalidasi hubungan karakter
- memvalidasi visual consistency
- memvalidasi planning consistency
- memvalidasi dialogue consistency
- menghasilkan validation report
- memberikan feedback untuk regenerasi

---

# 3. Responsibilities

Validation Runtime bertanggung jawab terhadap:

- Canon Validation
- Story Validation
- Character Validation
- Timeline Validation
- Dialogue Validation
- Visual Validation
- Continuity Validation
- Rule Validation
- Validation Metrics
- Validation Report

---

# 4. High Level Architecture

```text
                  Orchestrator

                       │

             Validation Runtime

      ┌────────────────┼────────────────┐

      │                │                │

 Canon Validator  Consistency Engine  Rule Engine

      │                │                │

      └────────────────┼────────────────┘

                       │

              Validation Report
```

---

# 5. Validation Pipeline

```text
Receive Episode Draft

↓

Load Canon References

↓

Run Validation Rules

↓

Detect Violations

↓

Generate Validation Report

↓

Decision

↓

Pass

atau

Regenerate
```

---

# 6. Validation Scope

Validation dilakukan terhadap:

- Episode Draft
- Scene
- Dialogue
- Character Behavior
- Timeline
- Location
- Relationship
- Visual Description
- Planning Blueprint
- Canon References

---

# 7. Validation Levels

Validation dilakukan secara bertingkat.

```
Level 1

Schema Validation

↓

Level 2

Structural Validation

↓

Level 3

Canon Validation

↓

Level 4

Continuity Validation

↓

Level 5

Quality Validation
```

Setiap level harus lolos sebelum melanjutkan ke level berikutnya.

---

# 8. Schema Validation

Memastikan seluruh output sesuai schema.

Contoh:

- Episode Schema
- Scene Schema
- Dialogue Schema
- Asset Schema

Schema yang tidak valid langsung ditolak.

---

# 9. Structural Validation

Memastikan struktur episode benar.

Contoh:

- urutan scene
- hubungan dialogue
- referensi karakter
- referensi lokasi

---

# 10. Canon Validation

Canon Validation memastikan:

- karakter benar
- fakta benar
- timeline benar
- aturan dunia benar
- hubungan karakter benar

Seluruh pemeriksaan menggunakan Universe Bible sebagai sumber utama.

---

# 11. Character Validation

Yang diperiksa:

- personality
- speaking style
- behavior
- motivation
- relationship
- visual identity

Karakter tidak boleh bertindak di luar batas Character Bible tanpa alasan yang telah direncanakan.

---

# 12. Timeline Validation

Timeline Validator memastikan:

- urutan kejadian
- umur karakter
- perkembangan cerita
- musim
- lokasi waktu

Tidak boleh ada kontradiksi dengan Episode History.

---

# 13. Dialogue Validation

Dialogue diperiksa terhadap:

- Character Bible
- Dialogue Rules
- Relationship
- Emotion Plan
- Scene Goal

Validator memastikan dialog mendukung tujuan scene dan tetap sesuai identitas karakter.

---

# 14. Visual Validation

Visual Description diperiksa terhadap:

- Visual Bible
- Character Appearance
- Location Description
- Art Direction
- Production Rules

---

# 15. Continuity Validation

Continuity Validator memastikan:

- cerita berlanjut dengan benar
- tidak ada konflik antar episode
- hubungan karakter konsisten
- lokasi tetap konsisten
- properti penting tetap ada

---

# 16. Rule Validation

Rule Engine memeriksa aturan khusus.

Contoh:

- karakter tertentu tidak boleh mengetahui informasi tertentu
- lokasi tertentu hanya muncul setelah episode tertentu
- aturan dunia tertentu hanya aktif pada kondisi tertentu

Aturan berasal dari Bible dan Rule Library.

---

# 17. Violation Classification

Setiap pelanggaran diklasifikasikan.

### Critical

Melanggar canon utama.

↓

Reject.

---

### Major

Mengganggu kontinuitas.

↓

Regenerate.

---

### Minor

Masalah kualitas.

↓

Review.

---

### Warning

Tidak memengaruhi canon.

↓

Catat.

---

# 18. Validation Decision

Hasil akhir hanya memiliki empat kemungkinan.

```text
PASS

PASS_WITH_WARNING

REGENERATE

REJECT
```

Decision dikirim ke Orchestrator.

---

# 19. Feedback Generation

Validation Runtime menghasilkan feedback yang terstruktur.

Contoh:

```text
Violation

↓

Character

↓

Buya

↓

Personality

↓

Too Aggressive

↓

Recommendation

Regenerate Dialogue
```

Feedback digunakan sebagai input regenerasi, bukan sebagai perubahan langsung pada konten.

---

# 20. Validation Report

Validation Report berisi:

```text
Validation ID

Status

Violations

Warnings

Canon References

Affected Scene

Affected Dialogue

Recommendations

Metrics
```

Report menjadi artefak resmi workflow.

---

# 21. Validation Events

Validation Runtime menghasilkan event.

```text
ValidationStarted

ValidationPassed

ValidationWarning

ValidationFailed

RegenerationRequested

ValidationCompleted
```

---

# 22. Validation Metrics

Metrik yang dicatat:

- Validation ID
- Workflow ID
- Validation Duration
- Rule Count
- Violation Count
- Warning Count
- Pass Rate
- Regeneration Count

---

# 23. Error Handling

### Missing Bible

Bible tidak tersedia.

↓

Abort Validation.

---

### Invalid Reference

Referensi tidak ditemukan.

↓

Warning.

↓

Review.

---

### Validation Engine Failure

Validator gagal dijalankan.

↓

Retry.

---

### Rule Conflict

Dua aturan bertentangan.

↓

Laporkan ke Review Runtime.

---

### Unknown Violation

Tidak dapat diklasifikasikan.

↓

Manual Review.

---

# 24. Configuration

Parameter yang dapat dikonfigurasi:

- Canon Strictness
- Continuity Level
- Validation Depth
- Warning Threshold
- Maximum Regeneration
- Rule Set
- Logging Level

---

# 25. Interface Contract

### Input

- Episode Draft
- Planning Blueprint
- Runtime Context
- Canon References
- Validation Configuration

### Output

- Validation Status
- Validation Report
- Violations
- Recommendations
- Metrics
- Error (jika ada)

---

# 26. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Mengendalikan proses validasi |
| Retrieval Runtime | Menyediakan referensi canon |
| Memory Runtime | Menyediakan context |
| Planning Runtime | Menyediakan blueprint |
| Generation Runtime | Menyediakan Episode Draft |
| Review Runtime | Menggunakan Validation Report |
| Production Runtime | Hanya menerima output yang lolos validasi |

Validation Runtime menjadi gerbang terakhir sebelum hasil AI dianggap layak.

---

# 27. Canon Enforcement

Validation Runtime adalah penjaga utama Universe Bible.

Seluruh hasil generation harus dapat ditelusuri ke:

- Universe Bible
- Character Bible
- Story Bible
- World Bible
- Planning Blueprint

Tidak ada output yang boleh:

- mengubah canon
- mengubah timeline
- mengubah karakter
- mengubah hubungan
- mengubah aturan dunia

Apabila ditemukan pelanggaran, Validation Runtime wajib menghentikan alur dan meminta regenerasi atau menolak output sepenuhnya.

---

# 28. Success Criteria

Validation Runtime dianggap berhasil apabila:

- seluruh pemeriksaan selesai dijalankan
- seluruh aturan canon diperiksa
- semua pelanggaran diklasifikasikan
- feedback regenerasi tersedia
- Validation Report berhasil dibuat
- hanya output yang valid diteruskan
- seluruh metrik dan event tercatat

---

# 29. Summary

Validation Runtime adalah **penjaga kualitas dan canon** AI Engine Suro & Buya.

Runtime ini memastikan bahwa setiap Episode Draft, scene, dialog, dan deskripsi visual sesuai dengan Universe Bible, Character Bible, Story Bible, serta seluruh aturan dunia yang telah ditetapkan. Dengan menyediakan laporan validasi yang terstruktur dan umpan balik untuk regenerasi, Validation Runtime menjamin bahwa AI Engine menghasilkan cerita yang konsisten, dapat diaudit, dan siap memasuki tahap Review maupun Production.