# 08-engine-spec/production-runtime.md

# Production Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Production Runtime bertanggung jawab mengubah hasil yang telah disetujui oleh Review Runtime menjadi **Production Package** yang siap digunakan oleh pipeline produksi serial Suro & Buya.

Production Runtime bukan AI Generator.

Production Runtime bukan Story Planner.

Production Runtime bukan Validator.

Production Runtime adalah tahap akhir AI Engine yang mengubah seluruh hasil kreatif menjadi artefak produksi yang terstruktur, konsisten, dan siap diproses oleh tim maupun pipeline produksi otomatis.

---

# 2. Goals

Production Runtime harus mampu:

- membangun Production Package
- menyusun seluruh asset produksi
- membentuk script final
- menghasilkan storyboard package
- menghasilkan visual package
- menghasilkan voice package
- menghasilkan metadata produksi
- menghasilkan manifest produksi
- melakukan versioning
- melakukan packaging

---

# 3. Responsibilities

Production Runtime bertanggung jawab terhadap:

- Production Packaging
- Script Packaging
- Asset Packaging
- Storyboard Packaging
- Visual Packaging
- Voice Packaging
- Manifest Generation
- Version Management
- Export
- Production Metrics

---

# 4. High Level Architecture

```text
                 Orchestrator

                      │

             Production Runtime

      ┌──────────────┼──────────────┐

      │              │              │

 Package Builder  Asset Builder  Manifest Builder

      │              │              │

      └──────────────┼──────────────┘

                     │

            Production Package
```

---

# 5. Production Pipeline

```text
Receive Review Package

↓

Verify Approval

↓

Collect Artifacts

↓

Build Production Assets

↓

Generate Manifest

↓

Versioning

↓

Package

↓

Export
```

---

# 6. Production Inputs

Production Runtime menerima:

- Review Package
- Approved Episode
- Validation Report
- Planning Blueprint
- Runtime Metadata
- Asset References
- Production Configuration

Production Runtime tidak menerima intent langsung dari Creator.

---

# 7. Production Outputs

Output utama adalah:

```
Production Package
```

Yang terdiri dari:

- Final Script
- Scene Breakdown
- Dialogue Script
- Storyboard Package
- Visual Package
- Voice Package
- Metadata
- Manifest
- Version Information

---

# 8. Final Script Builder

Final Script dibangun dari:

- Episode Draft
- Dialogue
- Scene
- Narrative
- Review Notes (yang telah diterapkan bila ada revisi)

Output:

```
episode-final.script
```

Script bersifat immutable setelah dipaketkan.

---

# 9. Storyboard Package

Storyboard Package berisi:

- Scene Order
- Camera Notes
- Visual Description
- Character Placement
- Environment Description
- Transition Notes

Output:

```
storyboard-package
```

Runtime ini hanya menyusun data, bukan menggambar storyboard.

---

# 10. Visual Package

Visual Package berisi referensi produksi visual.

Contoh:

- Character References
- Costume References
- Environment References
- Lighting Notes
- Color Palette
- Props
- Effects

Semua mengacu pada Visual Bible.

---

# 11. Voice Package

Voice Package berisi:

- Character List
- Dialogue
- Emotion Tags
- Speaking Style
- Pronunciation Notes
- Timing

Voice synthesis dilakukan oleh pipeline produksi, bukan oleh runtime ini.

---

# 12. Asset Manifest

Manifest menjelaskan seluruh aset.

Contoh:

```text
Episode

↓

Scene

↓

Asset

↓

Reference

↓

Version
```

Manifest menjadi sumber utama pipeline produksi.

---

# 13. Metadata Generation

Metadata meliputi:

- Episode ID
- Story ID
- Season ID
- Production Version
- Review Version
- Validation Version
- Build Timestamp
- Build Number

Metadata digunakan untuk audit dan versioning.

---

# 14. Version Management

Production Runtime mengelola versi.

Contoh:

```
Episode

1.0.0
```

↓

```
Revision

1.0.1
```

↓

```
Production

1.1.0
```

Semua perubahan harus memiliki riwayat.

---

# 15. Packaging

Seluruh artefak dikemas menjadi satu bundle.

Contoh:

```text
Production Package

├── Script
├── Storyboard
├── Visual
├── Voice
├── Metadata
├── Manifest
└── Reports
```

---

# 16. Export

Production Runtime mendukung ekspor ke berbagai target.

Contoh:

- JSON
- Markdown
- PDF
- Asset Bundle
- Internal Production Format

Format ekspor ditentukan melalui konfigurasi.

---

# 17. Production Events

Production Runtime menghasilkan event:

```text
ProductionStarted

AssetsCollected

ManifestGenerated

PackageBuilt

VersionCreated

ExportCompleted

ProductionCompleted
```

---

# 18. Production Metrics

Production Runtime mencatat:

- Production ID
- Workflow ID
- Build Duration
- Asset Count
- Manifest Count
- Export Count
- Package Size
- Build Version
- Success Status

---

# 19. Error Handling

### Review Not Approved

Review belum APPROVED.

↓

Abort Production.

---

### Missing Asset

Asset belum lengkap.

↓

Revision Required.

---

### Manifest Error

Manifest gagal dibuat.

↓

Retry.

---

### Export Failure

Ekspor gagal.

↓

Retry.

↓

Abort.

---

### Version Conflict

Versi sudah digunakan.

↓

Generate Version Baru.

---

# 20. Configuration

Production Runtime mendukung konfigurasi:

- Export Format
- Package Structure
- Version Policy
- Manifest Policy
- Asset Policy
- Metadata Policy
- Compression Policy
- Logging Level

---

# 21. Interface Contract

### Input

- Review Package
- Approved Episode
- Asset References
- Production Configuration

### Output

- Production Package
- Manifest
- Metadata
- Version Information
- Production Metrics
- Error (jika ada)

---

# 22. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Mengendalikan workflow produksi |
| Review Runtime | Menyediakan Review Package |
| Validation Runtime | Menyediakan Validation Report |
| Generation Runtime | Menyediakan artefak final |
| Memory Runtime | Menyediakan referensi yang diperlukan |
| Workflow Runtime | Menandai workflow selesai setelah packaging berhasil |

Production Runtime merupakan tahap terakhir AI Engine sebelum hasil diteruskan ke pipeline produksi.

---

# 23. Production Principles

Production Runtime mengikuti prinsip berikut.

### Immutable Output

Production Package tidak boleh berubah setelah dibentuk.

Perubahan hanya dapat dilakukan melalui workflow revisi baru.

---

### Traceable

Seluruh file harus dapat ditelusuri ke:

- Episode
- Scene
- Planning Blueprint
- Validation Report
- Review Package

---

### Reproducible

Dengan:

- Bible yang sama
- Blueprint yang sama
- Konfigurasi yang sama

Production Package harus dapat dibangun kembali secara konsisten.

---

### Versioned

Setiap build memiliki nomor versi unik.

---

### Production Ready

Output harus siap digunakan tanpa proses manual tambahan pada level AI Engine.

---

# 24. Production Package Structure

Contoh struktur:

```text
production-package/

├── metadata/
│   ├── episode.json
│   ├── build.json
│   └── version.json
│
├── script/
│   ├── final-script.md
│   ├── scene-list.json
│   └── dialogue.json
│
├── storyboard/
│   ├── storyboard.json
│   └── camera-notes.json
│
├── visual/
│   ├── visual-reference.json
│   ├── character-reference.json
│   └── environment-reference.json
│
├── voice/
│   ├── dialogue.json
│   ├── emotion.json
│   └── pronunciation.json
│
├── reports/
│   ├── validation-report.json
│   └── review-report.json
│
└── manifest.json
```

---

# 25. Success Criteria

Production Runtime dianggap berhasil apabila:

- Review Package berstatus APPROVED
- seluruh artefak berhasil dikumpulkan
- Production Package berhasil dibangun
- manifest lengkap
- metadata lengkap
- versi berhasil dibuat
- paket berhasil diekspor
- seluruh metrik dan event tercatat
- hasil siap diteruskan ke pipeline produksi

---

# 26. Summary

Production Runtime adalah tahap akhir AI Engine Suro & Buya.

Runtime ini mengubah Episode yang telah divalidasi dan disetujui menjadi **Production Package** yang lengkap, terversi, dapat diaudit, dan siap digunakan oleh pipeline produksi. Dengan memisahkan proses packaging dari generation, AI Engine menjaga pemisahan yang jelas antara proses kreatif dan proses produksi, sehingga hasil akhir tetap konsisten, dapat direproduksi, dan sesuai dengan Universe Bible.