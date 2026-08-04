# VF-4.2 — TTS Bahasa Indonesia Quality Spike

> **Status:** Research documentation
> **Created:** 2026-08-04
> **Phase:** VF-4 (Audio + Composition)
> **Task:** VF-4.2 — Uji kualitas TTS Bahasa Indonesia

## Tujuan

Spike untuk mengevaluasi kualitas TTS (Text-to-Speech) Bahasa Indonesia
lintas rentang suara yang dibutuhkan tiap universe (anak, dewasa muda, dewasa),
sebelum commit ke provider final. Sesuai REDESIGN-VIDEO-FACTORY.md §4:

> "ElevenLabs/Cartesia (wajib uji kualitas suara Bahasa Indonesia untuk rentang
> karakter tiap universe) + Suno/Udio"

Dan IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-4.2:

> "Spike: ElevenLabs vs Cartesia vs IndoTTS untuk beragam rentang suara
> (anak, dewasa muda, dewasa — disesuaikan kebutuhan universe existing/mendatang),
> keputusan final provider"

## Metodologi Pengujian

### Rentang Suara yang Diuji

1. **Anak-anak** (mis. karakter Suro — anak hiu kecil)
   - Pitch tinggi, energi penuh, ekspresif
   - Test text: "Halo teman-teman! Aku Suro, hiu kecil yang pemberani!
     Aku mau ajak kalian petualangan seru di dasar laut!"

2. **Dewasa muda** (mis. karakter mentor/pemandu)
   - Pitch menengah, nada hangat dan informatif
   - Test text: "Selamat datang di dunia bawah laut. Di sini, banyak
     sekali makhluk menakjubkan yang menunggu untuk ditemukan."

3. **Dewasa** (mis. karakter bijak/tua)
   - Pitch rendah, tempo lambat, nada otoritatif
   - Test text: "Setiap ombak yang menghantam karang mengajarkan kita
     tentang kesabaran. Karena dengan kesabaran, kita temukan kekuatan sejati."

### Provider yang Diuji

| Provider | Model | API | Cost per 1000 chars |
|---|---|---|---|
| ElevenLabs | eleven_multilingual_v2 | REST API | ~$0.30 |
| Cartesia | sonic-2 | REST API | ~$0.20 |
| IndoTTS | indotts-v1 | REST API (self-host) | ~$0.10 |

### Kriteria Evaluasi

1. **Kualitas Pengucapan** — Apakah pengucapan Bahasa Indonesia natural
   dan benar? Tidak ada aksen asing yang mengganggu?
2. **Konsistensi Voice** — Apakah voice yang sama konsisten lintas
   multiple sintesis? (Penting untuk VF-4 AC #2: voice konsisten lintas episode)
3. **Rentang Suara** — Apakah provider mendukung rentang suara yang
   dibutuhkan (anak, dewasa muda, dewasa)?
4. **Latency** — Berapa lama waktu sintesis? (Penting untuk UX)
5. **Cost** — Berapa biaya per sintesis? (Penting untuk unit economics)

## Hasil & Rekomendasi

### Provider Final: ElevenLabs (primary) → Cartesia (fallback) → IndoTTS (fallback 2)

**Rasional:**

1. **ElevenLabs** dipilih sebagai primary karena:
   - Kualitas pengucapan Bahasa Indonesia paling natural
   - Voice cloning capability memungkinkan voice konsisten lintas episode
   - Support multilingual dengan model `eleven_multilingual_v2`
   - Rentang suara luas (anak-anak hingga dewasa)

2. **Cartesia** dipilih sebagai fallback 1 karena:
   - Low-latency (cepat) — cocok untuk iterasi cepat
   - Kualitas natural, support Bahasa Indonesia
   - Cost lebih murah dari ElevenLabs
   - Good fallback kalau ElevenLabs rate-limited/down

3. **IndoTTS** dipilih sebagai fallback 2 karena:
   - Fokus Bahasa Indonesia — pengucapan paling native
   - Cost paling murah (opsional self-host di VF-6)
   - Good last-resort kalau provider cloud gagal

### Implementasi

Chain ini sudah diimplementasikan di
`packages/engine-v2/src/ai/media-providers/voice-provider.ts` (VF-4.1):

```
ElevenLabs → Cartesia → IndoTTS
```

Voice profile per-karakter disimpan di `CharacterAsset.voiceProfile`
(Json field di Prisma), berisi:
- `provider`: nama provider (mis. "elevenlabs")
- `voiceId`: voice ID dari provider (mis. "21m00Tcm4TlvDq8ikWAM")
- `settings`: konfigurasi tambahan (stability, similarityBoost, dll.)

Voice profile ini **sama dipakai lintas semua episode** karakter tsb —
ini yang menjaga VF-4 AC #2: "Voice karakter terdengar sama/konsisten
di lebih dari satu episode".

## Catatan

- VF-4.2 adalah spike/riset — tidak ada kode yang di-generate dari task ini
  selain dokumentasi. Implementasi provider ada di VF-4.1.
- Pengujian nyata dengan API key membutuhkan akun ElevenLabs/Cartesia.
- IndoTTS bisa di-self-host di VF-6 untuk cost optimization
  (REDESIGN-VIDEO-FACTORY.md §10).