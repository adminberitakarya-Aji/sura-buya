# Engine — AI Factory Vertical Slice

Ini adalah **bukti konsep yang benar-benar bisa dijalankan**, bukan spesifikasi/dokumen arsitektur. Tujuannya: menguji apakah pendekatan "Universe Bible sebagai satu-satunya sumber kebenaran untuk AI generation" benar-benar menghasilkan konten yang sesuai karakter, dunia, dan aturan yang sudah dirancang — sebelum invest ke sistem yang lebih besar.

## Kenapa Cuma Segini (Bukan Sistem Penuh)?

Lihat `AUDIT-REPORT.md` di root repo. Ringkasnya: sudah ada 165 file dokumentasi arsitektur (`docs/02` s.d. `docs/09`) untuk sistem AI Engine skala penuh — orchestrator, database, API gateway, security, dst — tapi belum ada satu baris kode yang benar-benar jalan, dan belum ada satu episode pun yang selesai ditulis.

`engine/` ini punya scope sengaja kecil:

```
Bible (markdown) → Context Builder → Claude API → Canon Validator → Output
```

Satu kemampuan (generate 1 scene dialog), diimplementasi penuh, dites, dan terbukti jalan. **Prinsipnya: jangan generalisasi sebelum satu vertical slice terbukti bekerja.** Kapasitas baru (episode planner, season planner, dialogue generator penuh) ditambahkan sebagai modul baru setelah slice ini divalidasi lewat pemakaian nyata — bukan didesain semua sekaligus di muka.

## Struktur

```
engine/
├── src/
│   ├── types/index.ts          # Tipe data inti (SceneRequest, GeneratedScene, dll)
│   ├── bible/loader.ts         # Baca file dari universe-bible/ (whitelist eksplisit)
│   ├── context/buildContext.ts # Pilih & rakit potongan bible yang relevan jadi context
│   ├── validate/canonCheck.ts  # Validasi rule-based terhadap World Rules
│   ├── generate/
│   │   ├── client.ts           # Wrapper Anthropic API
│   │   ├── promptTemplates.ts  # System prompt & user prompt
│   │   └── generateScene.ts    # Fungsi utama: context → API call → validasi
│   └── commands/generate-scene.ts  # CLI entry point
├── tests/canonCheck.test.ts    # Unit test validator (jalan tanpa API key)
└── output/                     # Hasil generate (gitignored)
```

## Cara Pakai

### 1. Install

```bash
cd engine
npm install
```

### 2. Setup API Key

```bash
cp .env.example .env
# Edit .env, isi ANTHROPIC_API_KEY dengan key asli Anda
```

### 3. Dry Run (tanpa API call — cek context & prompt yang akan dikirim)

```bash
npx tsx src/commands/generate-scene.ts --dry-run \
  --characters=suro,buya \
  --region=Bali \
  --premise="Suro terburu-buru masuk area upacara adat tanpa tahu aturannya"
```

### 4. Generate Sungguhan

```bash
npx tsx src/commands/generate-scene.ts \
  --characters=suro,buya \
  --region=Bali \
  --premise="Suro terburu-buru masuk area upacara adat tanpa tahu aturannya, Buya mencoba mengingatkan tapi kelewat penasaran soal sesajen"
```

Hasilnya tersimpan di `output/scene-<timestamp>.json`, berisi teks scene + hasil validasi canon.

### 5. Jalankan Test

```bash
npm test
```

## Apa yang Divalidasi Otomatis

Validator (`canonCheck.ts`) sengaja rule-based dan sederhana — jaring pengaman cepat, bukan pengganti review manusia:

- **World Rules**: tidak ada kata terkait senjata, kematian, kekerasan grafis, horor
- **Character presence**: karakter yang diminta muncul beneran disebut namanya
- **Structural sanity**: output tidak kosong, tidak kepanjangan

Yang **tidak** divalidasi otomatis (masih perlu review manusia): apakah humor-nya lucu tanpa merendahkan, apakah representasi budaya daerahnya akurat, apakah kelemahan karakter muncul secara natural (bukan dipaksakan), apakah nada bicaranya benar-benar sesuai Voice Guide.

## Kapan Boleh Mulai Ekspansi ke `docs/02-engine` dst?

Setelah:
1. Slice ini dipakai untuk generate beberapa scene sungguhan dan hasilnya dinilai bagus secara kualitas kreatif (bukan cuma lolos validator otomatis)
2. Episode 1 selesai ditulis (manual atau dibantu slice ini) sebagai acuan kualitas
3. Ada kebutuhan konkret yang jelas untuk kapasitas berikutnya (mis. "kita butuh generate season plan otomatis") — baru desain modul itu secara spesifik, bukan generalisasi dari 165 file spek yang sudah ada.
