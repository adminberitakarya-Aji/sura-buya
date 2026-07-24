# 08-engine-spec/generation-runtime.md

# Generation Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Generation Runtime bertanggung jawab mengubah **Planning Blueprint** menjadi artefak kreatif yang siap divalidasi.

Generation Runtime adalah satu-satunya runtime yang menghasilkan konten, seperti narasi, adegan, dialog, deskripsi visual, maupun artefak kreatif lainnya.

Generation Runtime **tidak membuat keputusan cerita**, **tidak mengubah canon**, dan **tidak menyusun struktur episode**. Seluruh keputusan tersebut telah ditetapkan oleh Planning Runtime.

Peran Generation Runtime adalah menerjemahkan blueprint menjadi hasil kreatif yang konsisten dengan Universe Bible.

---

# 2. Goals

Generation Runtime harus mampu:

- menghasilkan konten berdasarkan Planning Blueprint
- menjaga konsistensi karakter
- menjaga konsistensi dialog
- menjaga konsistensi visual
- menjaga konsistensi timeline
- menghasilkan output yang deterministik sejauh konfigurasi memungkinkan
- menghasilkan artefak yang siap divalidasi
- mendukung regenerasi parsial tanpa mengulang seluruh workflow

---

# 3. Responsibilities

Generation Runtime bertanggung jawab terhadap:

- Narrative Generation
- Scene Generation
- Dialogue Generation
- Visual Description Generation
- Emotion Rendering
- Character Voice Consistency
- Output Assembly
- Generation Metrics
- Generation Traceability

---

# 4. High Level Architecture

```text
                  Orchestrator

                       │

             Generation Runtime

      ┌────────────────┼────────────────┐

      │                │                │

 Scene Generator  Dialogue Generator  Narrative Generator

      │                │                │

      └────────────────┼────────────────┘

                       │

             Generated Artifacts
```

---

# 5. Generation Pipeline

```text
Receive Planning Blueprint

↓

Prepare Working Context

↓

Generate Scene

↓

Generate Dialogue

↓

Generate Narrative

↓

Generate Visual Description

↓

Assemble Output

↓

Return Generated Artifacts
```

Generation tidak boleh dimulai tanpa Planning Blueprint yang telah disetujui.

---

# 6. Generation Scope

Generation Runtime hanya menghasilkan artefak berikut:

- Scene Content
- Dialogue
- Narrative
- Action Description
- Visual Description
- Character Expression
- Environment Description
- Transition Description

Artefak lain, seperti storyboard atau voice asset, dihasilkan pada tahap Production Runtime.

---

# 7. Scene Generation

Scene Generator menghasilkan isi setiap scene berdasarkan blueprint.

Input:

- Scene Plan
- Character Context
- Timeline
- World Rules

Output:

```text
Scene

Action

Environment

Transition
```

Scene tidak boleh menyimpang dari tujuan yang telah ditentukan pada Planning Blueprint.

---

# 8. Dialogue Generation

Dialogue Generator menghasilkan dialog berdasarkan:

- Character Bible
- Relationship
- Personality
- Emotion
- Dialogue Rules
- Scene Context

Dialog harus:

- konsisten dengan karakter
- sesuai situasi
- mendukung tujuan scene
- tidak bertentangan dengan canon

---

# 9. Narrative Generation

Narrative Generator menghasilkan narasi penghubung.

Contoh:

- perpindahan lokasi
- deskripsi aksi
- perubahan suasana
- pengantar scene

Narasi harus mendukung cerita, bukan menggantikan dialog.

---

# 10. Visual Description Generation

Visual Description digunakan sebagai dasar produksi visual.

Contoh:

```text
Lokasi

Pencahayaan

Cuaca

Pose Karakter

Ekspresi

Properti

Atmosfer
```

Visual Description harus konsisten dengan Visual Bible.

---

# 11. Character Voice Consistency

Generation Runtime menjaga konsistensi gaya bicara setiap karakter.

Contoh aspek yang diperiksa:

- pilihan kata
- panjang kalimat
- gaya humor
- tingkat formalitas
- ekspresi emosional
- kebiasaan berbicara

Seluruh karakter harus mengikuti Character Bible.

---

# 12. Emotion Rendering

Setiap adegan memiliki kondisi emosi.

Generation Runtime menerjemahkan emotion plan menjadi:

- ekspresi karakter
- pilihan kata
- tempo dialog
- tindakan
- atmosfer

Emosi tidak boleh bertentangan dengan perkembangan karakter.

---

# 13. Incremental Generation

Generation dilakukan secara bertahap.

Contoh:

```text
Episode

↓

Scene 1

↓

Scene 2

↓

Scene 3
```

Jika Scene 3 gagal divalidasi, hanya Scene 3 yang diregenerasi.

---

# 14. Partial Regeneration

Generation Runtime mendukung regenerasi sebagian.

Contoh:

```
Dialogue Invalid

↓

Regenerate Dialogue
```

atau

```
Visual Description Invalid

↓

Regenerate Visual Description
```

Tidak perlu menghasilkan ulang seluruh episode.

---

# 15. Output Assembly

Setelah seluruh artefak selesai:

```text
Scene

+

Dialogue

+

Narrative

+

Visual Description

↓

Episode Draft
```

Episode Draft menjadi input untuk Validation Runtime.

---

# 16. Generation Events

Generation Runtime menghasilkan event:

```text
GenerationStarted

SceneGenerated

DialogueGenerated

NarrativeGenerated

VisualGenerated

OutputAssembled

GenerationCompleted
```

Event digunakan untuk monitoring dan audit.

---

# 17. Generation Metrics

Metrik yang dicatat:

- Generation ID
- Workflow ID
- Scene Count
- Dialogue Count
- Character Count
- Token Usage
- Generation Duration
- Regeneration Count
- Warning Count

---

# 18. Error Handling

Jenis kesalahan:

### Missing Blueprint

Planning Blueprint tidak tersedia.

↓

Batalkan generation.

---

### Missing Context

Working Context belum lengkap.

↓

Minta Memory Runtime melengkapi context.

---

### Dialogue Failure

Dialog gagal dihasilkan.

↓

Regenerate Dialogue.

---

### Scene Failure

Scene gagal dihasilkan.

↓

Regenerate Scene.

---

### Output Assembly Failure

Episode Draft tidak dapat dibentuk.

↓

Rollback ke artefak yang bermasalah.

---

# 19. Configuration

Generation Runtime mendukung konfigurasi:

- Maximum Scene Length
- Maximum Dialogue Length
- Narrative Style
- Dialogue Style
- Creativity Level
- Temperature
- Deterministic Mode
- Regeneration Policy
- Logging Level

---

# 20. Interface Contract

### Input

- Planning Blueprint
- Working Context
- Runtime Configuration

### Output

- Episode Draft
- Generated Artifacts
- Generation Metrics
- Warning
- Error (jika ada)

Seluruh output harus mempertahankan hubungan dengan blueprint asal untuk mendukung traceability.

---

# 21. Canon Protection

Generation Runtime wajib mematuhi batasan berikut:

- tidak mengubah struktur Planning Blueprint
- tidak menambah karakter baru tanpa perencanaan
- tidak mengubah timeline
- tidak mengubah hubungan karakter
- tidak mengubah aturan dunia
- tidak mengubah fakta canon

Jika model menghasilkan konten yang menyimpang, Validation Runtime akan menolaknya dan memicu regenerasi pada bagian terkait.

---

# 22. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Mengendalikan proses generation |
| Planning Runtime | Menyediakan Planning Blueprint |
| Memory Runtime | Menyediakan working memory |
| Retrieval Runtime | Menyediakan referensi tambahan jika diperlukan |
| Validation Runtime | Memeriksa hasil generation terhadap canon |
| Review Runtime | Mengevaluasi kualitas hasil generation |
| Production Runtime | Mengubah artefak tervalidasi menjadi aset produksi |

Generation Runtime menjadi satu-satunya runtime yang menghasilkan konten kreatif dalam AI Engine.

---

# 23. Traceability

Setiap artefak yang dihasilkan harus memiliki hubungan yang jelas dengan sumbernya.

Contoh:

```text
Episode Draft

├── Scene 1
│     ├── Scene Plan ID
│     ├── Character References
│     └── Canon References
│
├── Scene 2
│
└── Dialogue
      ├── Character Bible Reference
      └── Dialogue Rule Reference
```

Dengan demikian setiap kalimat dapat ditelusuri kembali ke:

- Planning Blueprint
- Working Context
- Universe Bible

Traceability mempermudah validasi, review, dan debugging.

---

# 24. Success Criteria

Generation Runtime dianggap berhasil apabila:

- seluruh scene berhasil dihasilkan
- seluruh dialog sesuai Character Bible
- narasi konsisten dengan blueprint
- visual description sesuai Visual Bible
- seluruh artefak berhasil dirakit menjadi Episode Draft
- tidak ada pelanggaran struktur planning
- regenerasi parsial dapat dilakukan tanpa memengaruhi bagian lain
- seluruh metrik dan event tercatat

---

# 25. Summary

Generation Runtime adalah mesin kreatif AI Engine Suro & Buya.

Ia menerjemahkan Planning Blueprint menjadi Episode Draft melalui proses generation scene, dialog, narasi, dan deskripsi visual. Seluruh output tetap berada dalam batas Universe Bible, dapat diregenerasi secara parsial, memiliki jejak asal (traceability), dan siap diteruskan ke Validation Runtime untuk memastikan kepatuhan terhadap canon.