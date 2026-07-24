# 08-engine-spec/retrieval-runtime.md

# Retrieval Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Retrieval Runtime bertanggung jawab mengambil seluruh pengetahuan (knowledge) yang diperlukan oleh AI Engine Suro & Buya sebelum proses planning, generation, validation, maupun production dimulai.

Retrieval Runtime memastikan bahwa setiap keputusan AI selalu didasarkan pada informasi resmi yang terdapat di dalam Universe Bible dan dokumen turunannya.

Retrieval Runtime **tidak menghasilkan konten**, **tidak melakukan inferensi kreatif**, dan **tidak mengubah canon**. Tugasnya hanya menemukan, menyaring, memberi peringkat, dan mengirimkan informasi yang paling relevan kepada runtime lain.

---

# 2. Goals

Retrieval Runtime harus mampu:

- menemukan informasi yang relevan
- mengambil data dari berbagai Bible
- melakukan semantic retrieval
- melakukan structured retrieval
- mengurutkan hasil berdasarkan relevansi
- menghilangkan informasi yang tidak relevan
- menjaga konsistensi canon
- mengoptimalkan ukuran context
- memberikan referensi yang dapat diaudit

---

# 3. Responsibilities

Retrieval Runtime bertanggung jawab terhadap:

- Knowledge Retrieval
- Canon Retrieval
- Semantic Search
- Structured Search
- Reference Resolution
- Context Selection
- Ranking
- Filtering
- Retrieval Metrics
- Retrieval Traceability

---

# 4. High Level Architecture

```text
                Orchestrator

                     │

             Retrieval Runtime

      ┌──────────────┼──────────────┐

      │              │              │

 Query Builder   Search Engine   Ranker

      │              │              │

      └──────────────┼──────────────┘

                     │

        Knowledge Repository

 Universe Bible

 Character Bible

 World Bible

 Story Bible

 Season Bible

 Production Bible
```

---

# 5. Knowledge Sources

Retrieval Runtime hanya mengambil informasi dari sumber resmi.

Sumber utama:

- Universe Bible
- Character Bible
- World Bible
- Story Bible
- Season Bible
- Episode History
- Canon Rules
- Dialogue Rules
- Visual Rules
- Production Rules

Tidak diperbolehkan menggunakan informasi di luar repository resmi tanpa mekanisme yang telah ditentukan.

---

# 6. Retrieval Pipeline

```text
Receive Query

↓

Normalize Query

↓

Identify Sources

↓

Search

↓

Rank

↓

Filter

↓

Resolve References

↓

Return Context
```

Pipeline ini berlaku untuk seluruh permintaan retrieval.

---

# 7. Query Builder

Query Builder mengubah kebutuhan runtime menjadi query yang dapat dieksekusi.

Contoh:

```
Generate Episode 5
```

menjadi:

```
Season 1

Episode 1–4

Main Characters

Timeline

World Rules

Dialogue Rules
```

Query Builder tidak menghasilkan konten baru, hanya menyusun kebutuhan informasi.

---

# 8. Search Strategy

Retrieval Runtime mendukung dua strategi utama.

### Structured Retrieval

Menggunakan relasi objek.

Contoh:

```text
Episode

↓

Season

↓

Story

↓

Universe
```

---

### Semantic Retrieval

Menggunakan kemiripan makna.

Contoh:

```
Persahabatan

↓

Scene serupa

↓

Dialogue Pattern
```

Kedua strategi dapat digunakan secara bersamaan.

---

# 9. Reference Resolution

Objek saling terhubung melalui referensi.

Contoh:

```
Scene

↓

Character Reference

↓

Character Bible
```

```
Episode

↓

Story Reference

↓

Story Bible
```

Referensi selalu diselesaikan sebelum context dikirim ke runtime lain.

---

# 10. Context Selection

Tidak semua hasil retrieval dikirim.

Retrieval Runtime memilih informasi yang:

- relevan
- terbaru dalam timeline
- masih berlaku
- diperlukan oleh runtime tujuan

Informasi yang tidak relevan dibuang.

---

# 11. Ranking

Hasil retrieval diberi peringkat berdasarkan:

- relevansi terhadap intent
- hubungan langsung
- kedekatan timeline
- prioritas canon
- skor semantic

Urutan ini memastikan informasi paling penting muncul lebih dahulu.

---

# 12. Filtering

Filtering menghapus:

- data duplikat
- data usang
- data di luar workflow
- referensi yang tidak valid
- informasi yang bertentangan dengan canon

Filtering tidak boleh mengubah isi informasi.

---

# 13. Context Packaging

Setelah retrieval selesai, informasi dikemas menjadi Runtime Context.

Contoh:

```text
Episode Context

├── Story
├── Timeline
├── Characters
├── Relationships
├── Locations
├── Canon Rules
├── Dialogue Rules
└── Visual Rules
```

Context dikirim ke Context Runtime untuk diproses lebih lanjut.

---

# 14. Incremental Retrieval

Retrieval Runtime dapat mengambil informasi secara bertahap.

Contoh:

```
Planning

↓

Retrieve Story
```

Kemudian:

```
Generation

↓

Retrieve Scene Details
```

Pendekatan ini mengurangi penggunaan token dan mempercepat proses.

---

# 15. Lazy Retrieval

Data hanya diambil saat benar-benar diperlukan.

Contoh:

Voice Production Rules tidak perlu diambil ketika engine masih berada pada tahap Episode Planning.

---

# 16. Retrieval Cache

Hasil retrieval dapat disimpan sementara.

Contoh cache:

- Character Profile
- Timeline
- Relationship Matrix
- World Rules
- Dialogue Rules

Cache hanya berlaku selama workflow aktif dan dikelola oleh Memory Runtime.

---

# 17. Retrieval Events

Retrieval Runtime menghasilkan event:

```
QueryReceived

SearchStarted

SearchCompleted

ReferenceResolved

ContextPrepared

CacheHit

CacheMiss

RetrievalCompleted
```

Event dikirim ke Orchestrator untuk observabilitas.

---

# 18. Retrieval Metrics

Metrik yang dicatat:

- Retrieval ID
- Query
- Knowledge Sources
- Documents Retrieved
- References Resolved
- Search Duration
- Ranking Duration
- Cache Hit Rate
- Cache Miss Rate
- Context Size

---

# 19. Error Handling

Jenis kesalahan:

### Missing Document

Dokumen tidak ditemukan.

↓

Laporkan ke Orchestrator.

↓

Abort atau Retry.

---

### Broken Reference

Referensi tidak dapat diselesaikan.

↓

Buang referensi.

↓

Laporkan sebagai warning.

---

### Ambiguous Result

Lebih dari satu hasil dengan skor sama.

↓

Gunakan aturan prioritas canon.

↓

Jika tetap ambigu, tandai untuk Review Runtime.

---

### Empty Result

Tidak ada hasil.

↓

Kembalikan context kosong.

↓

Orchestrator memutuskan langkah berikutnya.

---

### Repository Error

Repository tidak dapat diakses.

↓

Retry.

↓

Abort jika gagal.

---

# 20. Configuration

Parameter yang dapat dikonfigurasi:

- Maximum Documents
- Maximum Context Size
- Ranking Strategy
- Semantic Threshold
- Structured Search Policy
- Cache Policy
- Lazy Retrieval Policy
- Incremental Retrieval Policy
- Logging Level

---

# 21. Interface Contract

### Input

- Retrieval Request
- Intent
- Runtime Type
- Workflow Context
- Retrieval Configuration

### Output

- Retrieved Context
- References
- Metadata
- Retrieval Metrics
- Warning
- Error (jika ada)

Semua hasil retrieval harus menyertakan metadata asal informasi untuk mendukung audit.

---

# 22. Canon Protection

Retrieval Runtime merupakan gerbang pertama kepatuhan terhadap Universe Bible.

Aturan utama:

- hanya mengambil informasi dari repository resmi
- tidak membuat interpretasi kreatif
- tidak mengubah isi Bible
- tidak menggabungkan informasi yang saling bertentangan
- seluruh hasil harus dapat ditelusuri ke sumber asalnya

Setiap potongan context harus memiliki referensi yang jelas sehingga seluruh proses generation dapat diaudit.

---

# 23. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Mengirim permintaan retrieval |
| Memory Runtime | Menyimpan dan menyediakan cache hasil retrieval |
| Context Runtime | Menyusun hasil retrieval menjadi Runtime Context |
| Planning Runtime | Menggunakan context untuk menyusun rencana cerita |
| Generation Runtime | Menggunakan context untuk menghasilkan konten |
| Validation Runtime | Menggunakan referensi canon untuk validasi |
| Review Runtime | Mengakses sumber referensi saat melakukan review |

Retrieval Runtime menjadi satu-satunya jalur resmi untuk memperoleh pengetahuan dari Universe Bible.

---

# 24. Success Criteria

Retrieval Runtime dianggap berhasil apabila:

- seluruh dokumen yang relevan berhasil ditemukan
- referensi berhasil diselesaikan
- context yang dikirim sesuai kebutuhan runtime
- ukuran context tetap dalam batas konfigurasi
- tidak ada informasi di luar canon yang ikut terbawa
- seluruh hasil memiliki referensi yang dapat diaudit
- metrik dan event tercatat dengan lengkap

---

# 25. Summary

Retrieval Runtime adalah gerbang pengetahuan AI Engine Suro & Buya.

Ia bertugas menemukan, menyaring, memberi peringkat, dan mengemas informasi dari Universe Bible menjadi context yang siap digunakan oleh runtime lain. Dengan memastikan setiap informasi berasal dari sumber resmi dan dapat ditelusuri kembali ke asalnya, Retrieval Runtime menjadi fondasi utama konsistensi canon di seluruh pipeline AI Engine.