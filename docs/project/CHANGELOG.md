# Changelog

Semua perubahan penting pada repository **Suro & Buya: Petualang Cilik Nusantara – Universe Bible** akan didokumentasikan dalam berkas ini.

Format changelog mengacu pada prinsip **Keep a Changelog** dan menggunakan **Semantic Versioning** sebagai referensi pengelolaan versi dokumentasi.

---

# [Unreleased]

## Added

* `AUDIT-REPORT.md` — audit menyeluruh 165 file di repo: menemukan ketimpangan besar antara volume dokumentasi arsitektur (`docs/02` s.d. `docs/09`, ~69.800 baris) vs konten kreatif inti (`universe-bible/`, ~8.400 baris), dengan `episode-01-draft.md` masih kosong. Rekomendasi: hentikan penambahan dokumen arsitektur sampai ada vertical slice yang terbukti jalan dan Episode 1 selesai.
* `engine/` — vertical slice AI Factory yang **benar-benar diimplementasi dan dites** (bukan spesifikasi): bible loader, context builder, canon validator (rule-based), dan generator via Claude API untuk generate 1 scene dialog. Typecheck lolos, unit test validator lolos (4/4), dry-run terverifikasi membaca isi asli `universe-bible/`. Lihat `engine/README.md`.
* `README.md` — ditambahkan penjelasan status `engine/` (✅ jalan) vs `docs/` (⚠️ masih konseptual, belum diimplementasi).

## Fixed

* `02-world-bible/03-canon-rules.md` — menambahkan aturan **"Weakness Must Have Consequence"**: kelemahan karakter utama wajib berdampak nyata terhadap cerita, tidak boleh hanya disebutkan sebagai sifat kosong. Aturan ini sebelumnya hanya ada dalam diskusi dan belum tercatat sebagai canon resmi.
* `05-production-bible/04-brand-protection.md` — menambahkan bagian **"Differentiation from Persebaya Mascots"**: penjelasan asal-usul legenda Sura-Baya yang sama-sama diwarisi oleh IP ini dan maskot Persebaya (Jojo & Zoro), beserta panduan konkret agar desain visual tetap berbeda dan posisi sebagai karya independen tetap jelas.
* `README.md` — sinkronisasi tabel status: mayoritas file yang sebelumnya ditandai 🚧 ternyata sudah berisi draft lengkap, diubah jadi ⏳. Hanya `episodes/episode-01-draft.md` yang benar-benar masih kosong (0 byte) dan tetap 🚧.

## Added

* Placeholder untuk perubahan yang belum dirilis.
* Dokumentasi yang sedang dalam proses penyusunan.
* Draft dan revisi yang masih menunggu persetujuan.

---

# [1.0.0] - 2026-07-23

## Foundation Release

Rilis awal Universe Bible.

Versi ini menetapkan fondasi resmi untuk seluruh pengembangan IP **Suro & Buya: Petualang Cilik Nusantara**.

---

## Added

### Foundation

* Repository structure
* Documentation principles
* Canon philosophy
* Universe Bible framework

---

### Character Bible

* Overview
* Character creation principles
* Main character framework
* Supporting character framework
* Character relationship guide
* Character development guide
* Character consistency rules

---

### World Bible

* Overview
* Geography setting
* Lore
* Canon rules
* Regional culture guide

---

### Story Bible

* Overview
* Season structure
* Episode formula
* Character arcs
* Themes per season
* Story Do's & Don'ts

---

### Visual Bible

* Overview
* Visual Style Guide
* Art Direction
* Environment Design
* AI Prompt Bible
* Model Sheets

---

### Production Bible

* Overview
* Franchise Guide
* Production Pipeline
* Quality Assurance Checklist
* Brand Protection

---

## Established

Repository governance.

Documentation hierarchy.

Canon hierarchy.

Cross-document references.

Versioning policy.

Documentation standards.

AI-assisted documentation workflow.

---

## Notes

Versi **1.0.0** merupakan fondasi resmi Universe Bible dan menjadi acuan utama untuk seluruh pengembangan cerita, visual, produksi, serta ekspansi franchise **Suro & Buya**.

Seluruh revisi berikutnya harus mempertahankan kompatibilitas terhadap canon yang telah ditetapkan, kecuali terdapat keputusan resmi yang didokumentasikan dalam repository.

---

# Versioning Policy

Dokumentasi menggunakan prinsip Semantic Versioning.

## Major

Perubahan besar yang memengaruhi struktur Universe Bible atau canon.

Contoh:

* perubahan filosofi IP
* perubahan struktur dokumentasi
* perubahan canon utama

---

## Minor

Penambahan dokumen, bab, atau fitur baru yang tetap kompatibel dengan canon sebelumnya.

Contoh:

* dokumen baru
* pedoman baru
* perluasan framework

---

## Patch

Perbaikan yang tidak mengubah makna dokumentasi.

Contoh:

* typo
* tata bahasa
* klarifikasi
* referensi silang
* perbaikan format

---

# Legend

**Added**

Dokumen atau fitur baru.

**Changed**

Perubahan terhadap dokumentasi yang sudah ada.

**Deprecated**

Bagian yang masih tersedia tetapi akan dihapus pada versi mendatang.

**Removed**

Bagian yang telah dihapus.

**Fixed**

Perbaikan kesalahan.

**Security**

Perubahan yang berkaitan dengan keamanan aset, akses, atau tata kelola repository.

---

# Current Version

**v1.0.0**

Status

✅ Foundation Complete
