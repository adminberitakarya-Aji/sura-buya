# 08-engine-spec/memory-runtime.md

# Memory Runtime Specification

Version: 1.0

Status: Draft

---

# 1. Purpose

Memory Runtime bertanggung jawab mengelola seluruh memori yang digunakan selama proses eksekusi AI Engine Suro & Buya.

Memory Runtime memastikan bahwa setiap runtime selalu bekerja menggunakan informasi yang benar, konsisten, dan relevan terhadap Universe Bible.

Memory Runtime **bukan database**.

Memory Runtime adalah lapisan yang mengatur:

- penyimpanan context
- pengambilan context
- cache
- working memory
- session memory
- execution memory
- memory lifecycle

Memory Runtime tidak menghasilkan cerita dan tidak mengambil keputusan kreatif.

---

# 2. Goals

Memory Runtime harus mampu:

- mengelola working memory
- mengelola execution memory
- mengelola session memory
- mengelola cache
- mengelola context sharing
- menghapus memory yang tidak diperlukan
- mengoptimalkan penggunaan token
- menjaga konsistensi context selama workflow berlangsung

---

# 3. Responsibilities

Memory Runtime bertanggung jawab terhadap:

- Working Memory
- Session Memory
- Execution Memory
- Context Cache
- Memory Lifecycle
- Memory Synchronization
- Context Compression
- Context Reference
- Memory Metrics
- Memory Cleanup

---

# 4. High Level Architecture

```text
                 Orchestrator

                      │

               Memory Runtime

      ┌────────────┼────────────┐

      │            │            │

 Working     Execution     Session

 Memory        Memory       Memory

      │            │            │

      └────────────┼────────────┘

                   │

             Runtime Context
```

---

# 5. Memory Model

Memory Runtime terdiri dari empat lapisan utama.

```
Persistent Memory

↓

Session Memory

↓

Execution Memory

↓

Working Memory
```

Semakin ke bawah, umur memory semakin pendek.

---

# 6. Persistent Memory

Persistent Memory berasal dari repository engine.

Contohnya:

- Universe Bible
- Character Bible
- World Bible
- Story Bible
- Season Bible
- Canon Rules
- Visual Rules
- Production Rules

Memory ini tidak diubah selama eksekusi.

Semua perubahan harus dilakukan melalui proses authoring Creator, bukan oleh runtime.

---

# 7. Session Memory

Session Memory berlaku selama satu sesi Creator.

Contoh:

```
Create Episode 5
```

Semua parameter:

- intent
- target season
- target episode
- user preference
- runtime configuration

disimpan pada Session Memory.

Session selesai → memory dibersihkan.

---

# 8. Execution Memory

Execution Memory berlaku selama satu workflow.

Contoh:

```
Retrieve Bible

↓

Build Context

↓

Planning

↓

Generation

↓

Validation
```

Semua output antar-stage disimpan di Execution Memory.

Workflow selesai → Execution Memory dihapus.

---

# 9. Working Memory

Working Memory adalah memory yang dikirim ke runtime tertentu.

Contoh:

Generation Runtime hanya menerima:

- context yang relevan
- scene aktif
- karakter aktif
- aturan dialog
- timeline terkait

Working Memory sengaja dibuat sekecil mungkin untuk menghemat token dan meningkatkan fokus model.

---

# 10. Memory Lifecycle

```
Allocate

↓

Populate

↓

Use

↓

Update

↓

Release
```

Memory tidak boleh hidup lebih lama dari yang diperlukan.

---

# 11. Context Ownership

Memory Runtime menjadi pemilik seluruh context selama workflow berjalan.

Runtime lain:

- tidak menyimpan context permanen
- tidak saling berbagi memory secara langsung
- selalu meminta context melalui Memory Runtime

Hal ini menjaga konsistensi dan menghindari duplikasi.

---

# 12. Context Sharing

Context dibagikan berdasarkan kebutuhan.

Contoh:

Planning Runtime

↓

menerima:

- Story Bible
- Season Bible
- Episode History

Sedangkan:

Dialogue Runtime

↓

menerima:

- Scene
- Character
- Relationship
- Dialogue Rules

Bukan seluruh Universe Bible.

---

# 13. Context Reference

Memory Runtime menggunakan referensi, bukan salinan penuh.

Contoh:

```
Scene

↓

Character Reference

↓

Character Bible
```

Dengan pendekatan ini, context tetap konsisten dan penggunaan memori menjadi lebih efisien.

---

# 14. Memory Cache

Memory Runtime menyediakan cache untuk data yang sering digunakan.

Contoh:

- Character Profile
- Relationship Matrix
- Timeline
- World Rules
- Vocabulary
- Visual Identity

Cache bersifat sementara dan dapat dibangun ulang dari Persistent Memory.

---

# 15. Context Compression

Jika ukuran context melebihi batas yang ditentukan:

```
Full Context

↓

Compression

↓

Essential Context
```

Context Compression hanya boleh:

- menghapus data yang tidak relevan
- meringkas informasi yang telah tervalidasi

Tidak boleh mengubah fakta canon.

---

# 16. Context Expansion

Apabila runtime memerlukan informasi tambahan:

```
Working Memory

↓

Expand

↓

Retrieve Reference

↓

Update Working Memory
```

Expansion dilakukan secara bertahap agar penggunaan token tetap efisien.

---

# 17. Memory Synchronization

Semua runtime membaca context dari sumber yang sama.

Dengan demikian:

- tidak ada dua versi Character Bible
- tidak ada dua timeline
- tidak ada dua canon yang berbeda

Sinkronisasi menjadi tanggung jawab Memory Runtime.

---

# 18. Memory Isolation

Setiap workflow memiliki ruang memorinya sendiri.

Contoh:

```
Workflow A

≠

Workflow B
```

Execution Memory antar-workflow tidak boleh saling memengaruhi kecuali melalui Persistent Memory yang sama.

---

# 19. Memory Events

Memory Runtime menghasilkan event berikut:

```
MemoryAllocated

MemoryLoaded

MemoryExpanded

MemoryCompressed

MemoryReleased

CacheHit

CacheMiss

ContextUpdated
```

Event digunakan untuk observabilitas dan optimasi performa.

---

# 20. Memory Metrics

Memory Runtime mencatat:

- Memory ID
- Session ID
- Workflow ID
- Working Memory Size
- Cache Size
- Cache Hit Rate
- Cache Miss Rate
- Context Expansion Count
- Context Compression Count
- Memory Lifetime
- Token Estimate

---

# 21. Error Handling

Jenis kesalahan:

### Missing Context

Context tidak ditemukan.

↓

Minta Retrieval Runtime mengambil ulang.

---

### Invalid Reference

Referensi tidak valid.

↓

Batalkan context.

↓

Bangun ulang.

---

### Cache Failure

Cache rusak atau kedaluwarsa.

↓

Bangun ulang dari Persistent Memory.

---

### Memory Overflow

Working Memory melebihi batas.

↓

Lakukan Context Compression.

---

### Synchronization Error

Versi context tidak sinkron.

↓

Muat ulang dari sumber resmi.

---

# 22. Configuration

Memory Runtime mendukung konfigurasi:

- Maximum Working Memory
- Maximum Execution Memory
- Maximum Session Memory
- Cache Size
- Cache Expiration
- Compression Policy
- Expansion Policy
- Cleanup Policy
- Memory Metrics
- Logging Level

---

# 23. Relationship with Other Runtimes

| Runtime | Interaksi |
|---------|-----------|
| Orchestrator | Mengalokasikan dan melepas memory |
| Retrieval Runtime | Memuat data dari Bible |
| Context Runtime | Menyusun context yang akan disimpan |
| Planning Runtime | Membaca working memory |
| Generation Runtime | Membaca working memory |
| Validation Runtime | Membaca context canon |
| Review Runtime | Mengakses hasil workflow |
| Production Runtime | Mengakses hasil final |

Memory Runtime menjadi pusat distribusi context bagi seluruh runtime.

---

# 24. Canon Protection

Memory Runtime bertanggung jawab menjaga integritas informasi canon.

Aturan utama:

- Persistent Memory bersifat read-only selama workflow.
- Working Memory tidak boleh mengubah fakta canon.
- Perubahan hasil generation disimpan sebagai artefak workflow, bukan sebagai pembaruan Bible.
- Hanya Creator Workflow yang dapat memperbarui Universe Bible melalui proses authoring yang terpisah.

Dengan demikian, AI Engine tidak pernah "belajar" atau mengubah canon secara otomatis saat menghasilkan cerita.

---

# 25. Success Criteria

Memory Runtime dianggap berhasil apabila:

- context yang tepat tersedia untuk setiap runtime
- tidak ada duplikasi informasi
- working memory tetap dalam batas konfigurasi
- cache bekerja secara efektif
- context dapat diperluas dan dikompresi tanpa mengubah canon
- seluruh memory dibersihkan setelah workflow selesai
- seluruh metrik dan event tercatat
- integritas Universe Bible tetap terjaga

---

# 26. Summary

Memory Runtime adalah pengelola memori AI Engine Suro & Buya.

Ia mengatur bagaimana informasi dari Universe Bible dan hasil workflow disimpan, dibagikan, diperluas, dikompresi, serta dibersihkan selama proses berlangsung. Dengan memisahkan pengelolaan memori dari runtime lainnya, engine memperoleh context yang konsisten, efisien, dapat diaudit, dan selalu selaras dengan Universe Bible.