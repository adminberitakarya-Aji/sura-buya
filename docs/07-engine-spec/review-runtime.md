# 08-engine-spec/review-runtime.md

# Review Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Review Runtime bertanggung jawab melakukan evaluasi akhir terhadap hasil yang telah lolos Validation Runtime sebelum diteruskan ke Production Runtime.

Berbeda dengan Validation Runtime yang berfokus pada **kepatuhan terhadap canon dan aturan**, Review Runtime berfokus pada **kualitas hasil**.

Review Runtime menjawab pertanyaan:

> "Apakah episode ini layak diproduksi?"

Review Runtime **tidak mengubah konten**.

Review Runtime hanya:

- mengevaluasi
- memberi skor
- memberikan rekomendasi
- menghasilkan Review Package
- menentukan status kelayakan produksi

---

# 2. Goals

Review Runtime harus mampu:

- mengevaluasi kualitas cerita
- mengevaluasi kualitas dialog
- mengevaluasi kualitas pacing
- mengevaluasi kualitas karakter
- mengevaluasi kualitas visual description
- mengevaluasi kualitas episode secara keseluruhan
- menghasilkan review report
- menghasilkan production recommendation

---

# 3. Responsibilities

Review Runtime bertanggung jawab terhadap:

- Story Review
- Character Review
- Dialogue Review
- Scene Review
- Visual Review
- Pacing Review
- Production Readiness Review
- Quality Scoring
- Review Report
- Review Metrics

---

# 4. High Level Architecture

```text
                  Orchestrator

                       │

                Review Runtime

      ┌────────────────┼────────────────┐

      │                │                │

 Story Reviewer   Quality Engine   Score Engine

      │                │                │

      └────────────────┼────────────────┘

                       │

               Review Package
```

---

# 5. Review Pipeline

```text
Receive Validated Episode

↓

Load Validation Report

↓

Run Quality Review

↓

Calculate Scores

↓

Generate Recommendations

↓

Build Review Package

↓

Return Review Result
```

Review hanya dapat dilakukan apabila status Validation adalah **PASS** atau **PASS_WITH_WARNING**.

---

# 6. Review Scope

Review dilakukan terhadap:

- Episode
- Scene
- Dialogue
- Narrative
- Character Development
- Emotional Flow
- Pacing
- Visual Description
- Production Readiness

---

# 7. Story Review

Story Reviewer mengevaluasi:

- kejelasan alur
- perkembangan konflik
- penyelesaian konflik
- kesinambungan cerita
- keterhubungan dengan episode sebelumnya
- kontribusi terhadap Story Arc

Review tidak memeriksa canon karena hal tersebut sudah dilakukan pada Validation Runtime.

---

# 8. Scene Review

Setiap scene diperiksa terhadap:

- tujuan scene
- transisi
- durasi
- keseimbangan aksi dan dialog
- kontribusi terhadap episode

Scene yang tidak memiliki fungsi jelas diberi rekomendasi revisi.

---

# 9. Dialogue Review

Dialogue Reviewer mengevaluasi:

- naturalitas dialog
- variasi percakapan
- kejelasan informasi
- ritme percakapan
- kekuatan emosi
- konsistensi suara karakter

Dialog yang valid secara canon belum tentu berkualitas tinggi.

---

# 10. Character Review

Character Reviewer memeriksa:

- perkembangan karakter
- konsistensi motivasi
- dinamika hubungan
- keseimbangan kemunculan karakter
- kontribusi terhadap cerita

---

# 11. Pacing Review

Pacing dievaluasi berdasarkan:

- distribusi konflik
- distribusi dialog
- distribusi aksi
- panjang scene
- perpindahan antar scene

Episode tidak boleh terasa terlalu lambat maupun terlalu cepat.

---

# 12. Visual Review

Visual Description dievaluasi terhadap:

- kejelasan visual
- kemudahan divisualisasikan
- konsistensi atmosfer
- kesinambungan lokasi
- kesiapan storyboard

---

# 13. Production Readiness Review

Review Runtime memeriksa apakah episode telah siap diproduksi.

Contoh:

- seluruh scene lengkap
- dialog lengkap
- visual description lengkap
- referensi aset tersedia
- tidak ada placeholder

---

# 14. Quality Scoring

Setiap kategori diberi skor.

Contoh:

```text
Story

95

Dialogue

92

Character

94

Pacing

90

Visual

96

Production

98
```

Nilai akhir dihitung berdasarkan bobot yang ditentukan dalam konfigurasi.

---

# 15. Review Recommendation

Review Runtime memberikan rekomendasi.

Kemungkinan hasil:

```text
APPROVED
```

```text
APPROVED_WITH_NOTES
```

```text
REVISION_REQUIRED
```

```text
REJECTED
```

Rekomendasi bersifat operasional dan tidak mengubah hasil generation secara otomatis.

---

# 16. Review Package

Output utama Review Runtime adalah Review Package.

Contoh:

```text
Episode Summary

Quality Scores

Review Notes

Strengths

Weaknesses

Production Readiness

Recommendations
```

Review Package menjadi artefak resmi sebelum memasuki Production Runtime.

---

# 17. Review Events

Review Runtime menghasilkan event:

```text
ReviewStarted

QualityScored

ReviewCompleted

RevisionRequested

ProductionApproved
```

---

# 18. Review Metrics

Metrik yang dicatat:

- Review ID
- Workflow ID
- Review Duration
- Overall Score
- Story Score
- Dialogue Score
- Character Score
- Visual Score
- Production Score
- Recommendation

---

# 19. Error Handling

### Missing Validation Report

Validation belum selesai.

↓

Abort Review.

---

### Incomplete Episode

Episode belum lengkap.

↓

Revision Required.

---

### Missing Visual Description

Visual belum tersedia.

↓

Revision Required.

---

### Review Engine Failure

Runtime gagal.

↓

Retry.

---

### Unknown Issue

Tidak dapat dikategorikan.

↓

Manual Review.

---

# 20. Configuration

Review Runtime mendukung konfigurasi:

- Quality Threshold
- Story Weight
- Dialogue Weight
- Character Weight
- Pacing Weight
- Visual Weight
- Production Weight
- Approval Threshold
- Logging Level

---

# 21. Interface Contract

### Input

- Validated Episode
- Validation Report
- Planning Blueprint
- Runtime Context
- Review Configuration

### Output

- Review Package
- Recommendation
- Quality Scores
- Review Notes
- Metrics
- Error (jika ada)

---

# 22. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Memulai proses review |
| Validation Runtime | Menyediakan Validation Report |
| Planning Runtime | Menyediakan blueprint sebagai referensi |
| Generation Runtime | Menyediakan Episode Draft yang telah tervalidasi |
| Memory Runtime | Menyediakan context tambahan jika diperlukan |
| Production Runtime | Menerima Review Package yang telah disetujui |

Review Runtime menjadi tahap evaluasi kualitas terakhir sebelum produksi dimulai.

---

# 23. Review Principles

Review Runtime mengikuti prinsip berikut:

### Canon Already Valid

Review tidak memeriksa ulang canon.

Validation Runtime telah menyelesaikan tugas tersebut.

---

### Quality First

Fokus utama adalah kualitas hasil.

---

### Non-Destructive

Review tidak mengubah konten.

Seluruh rekomendasi bersifat terpisah.

---

### Traceable

Seluruh skor dan rekomendasi harus dapat ditelusuri ke scene atau bagian yang dievaluasi.

---

### Production-Oriented

Seluruh evaluasi dilakukan dari perspektif kesiapan produksi, bukan sekadar kualitas tulisan.

---

# 24. Production Decision

Review Runtime menghasilkan keputusan akhir sebelum produksi.

```text
Validation PASS

↓

Review

↓

APPROVED

↓

Production Runtime
```

atau

```text
Validation PASS

↓

Review

↓

REVISION REQUIRED

↓

Generation Runtime
```

Dengan demikian, Review Runtime menjadi gerbang kualitas terakhir dalam pipeline.

---

# 25. Success Criteria

Review Runtime dianggap berhasil apabila:

- seluruh aspek kualitas dievaluasi
- skor berhasil dihitung
- Review Package berhasil dibuat
- rekomendasi produksi tersedia
- tidak ada konten yang dimodifikasi selama review
- seluruh metrik dan event tercatat
- keputusan akhir berhasil dikirim ke Orchestrator

---

# 26. Summary

Review Runtime adalah evaluator kualitas AI Engine Suro & Buya.

Runtime ini memastikan bahwa hasil yang telah lolos Validation Runtime benar-benar layak diproduksi dengan menilai kualitas cerita, dialog, karakter, pacing, visual, dan kesiapan produksi. Output utamanya berupa Review Package yang berisi skor, catatan, rekomendasi, dan keputusan akhir sebagai dasar masuk ke Production Runtime.