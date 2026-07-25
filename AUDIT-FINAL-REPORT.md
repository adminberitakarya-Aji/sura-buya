# Audit Report — sura-buya

**Repo:** `adminberitakarya-Aji/sura-buya`
**Tanggal audit:** 25 Juli 2026
**Commit yang diaudit:** `e0cdba6` (feat(engine-v2): add skill system infrastructure...)
**Metode:** Clone repo, `pnpm install`, jalankan `pnpm -r build`, `pnpm -r lint`, `pnpm -r test` secara nyata (bukan hanya review kode statis).

---

## Ringkasan Eksekutif

Repo ini punya `AUDIT-FINAL-REPORT.md` di root yang mengklaim semua quality gate **PASS** (build ✅, lint ✅, test ✅ dengan 58 test). Laporan itu sudah basi — dibuat sebelum dua commit terakhir (migrasi pnpm monorepo besar-besaran + penambahan sistem "skills" di `engine-v2`).

**Kondisi aktual saat ini: build gagal, lint crash, dan nol test file di seluruh repo.**

| Check | Status | Detail |
|---|---|---|
| Install (`pnpm install`) | ✅ PASS | Berhasil, 567 package terpasang (ada warning non-fatal checksum Prisma) |
| Build (`pnpm -r build`) | ❌ FAIL | `engine-v2` gagal build — ~24 error TypeScript |
| Lint (`pnpm -r lint`) | ❌ FAIL | `engine-v2` crash karena hardcoded path Windows |
| Test (`pnpm -r test`) | ❌ FAIL | Nol file test di seluruh repo |

---

## Temuan Kritis

### 1. Build `engine-v2` gagal — root cause: `rootDir` salah konfigurasi

`packages/shared`, `packages/engine-v2`, `packages/templates/universe`, dan `packages/config` semua menggunakan:

```json
"rootDir": ".",
"include": ["src/**/*", "tests/**/*"]
```

Karena `rootDir` diset ke root paket (bukan `src`), TypeScript mengeluarkan output ke `dist/src/index.js`, **bukan** `dist/index.js` seperti yang dijanjikan `package.json`:

```json
"main": "dist/index.js",
"types": "dist/index.d.ts",
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", ... } }
```

Akibatnya paket lain yang mengimpor `@suro-buya/shared` tidak menemukan module-nya:

```
src/context.ts(16,66): error TS2307: Cannot find module '@suro-buya/shared'
src/types.ts(18,8): error TS2307: Cannot find module '@suro-buya/shared'
src/validate.ts(17,25): error TS2307: Cannot find module '@suro-buya/shared'
```

Ini bug fondasi — merusak seluruh dependency chain (`shared` → `engine-v2` → `cli`/`web`).

**Perbandingan:** `apps/cli/tsconfig.json` sudah benar (`"rootDir": "src"`) dan bisa dijadikan referensi perbaikan untuk paket lain.

**Fix:** ubah `rootDir` ke `"src"` di keempat tsconfig, atau sesuaikan `outDir`/`exports` agar konsisten dengan struktur `dist/src/...` yang dihasilkan.

---

### 2. Lint `engine-v2` crash — absolute path Windows ter-commit

`packages/engine-v2/package.json`:

```json
"lint": "eslint src/index.ts src/context.ts src/generate.ts src/types.ts src/validate.ts src/commands.ts --config d:/suro-buya/eslint.config.cjs --no-ignore --no-warn-ignored"
```

Path `d:/suro-buya/eslint.config.cjs` adalah absolute path drive lokal Windows Mas Aji, kemungkinan ter-commit tanpa sadar. Di Linux/Mac/CI langsung error:

```
Error: ENOENT: no such file or directory, stat '.../packages/engine-v2/d:/suro-buya/eslint.config.cjs'
```

**Fix:** ganti ke path relatif, misal `--config ../../eslint.config.cjs` (pola yang sudah dipakai di `apps/cli`).

---

### 3. Nol test file di seluruh repo

`AUDIT-FINAL-REPORT.md` lama mengklaim 58 test lulus di 4 paket. Sekarang:

```bash
$ find . -iname "*.test.ts" -o -iname "*.spec.ts" | grep -v node_modules
# (kosong — tidak ada satupun)
```

`pnpm -r test` gagal di `packages/shared` karena vitest tidak menemukan file test apapun. Kemungkinan file test terhapus/tidak ikut ter-commit saat migrasi monorepo.

---

### 4. ~24 error TypeScript strict-mode di kode skill baru

Mayoritas parameter implicit `any` (melanggar `noImplicitAny`) di file-file baru `src/skills/**`, `src/bible/**`, `src/generate/**`, `src/plan/**` — pola yang konsisten dengan kode yang digenerate cepat tanpa pernah dijalankan `tsc --noEmit` sebelum commit. Contoh:

```
src/skills/audit/consistency-auditor.ts(293,75): error TS7006: Parameter 'w' implicitly has an 'any' type.
src/plan/episode-planner.ts(257,48): error TS7006: Parameter 'sum' implicitly has an 'any' type.
src/generate/orchestrator.ts(639,41): error TS7006: Parameter 'scene' implicitly has an 'any' type.
```

Plus satu bug tipe nyata di `src/skills/writing/dialogue-writer.ts`:

```
src/skills/writing/dialogue-writer.ts(302,12): error TS7053: Element implicitly has an 'any' type
because expression of type 'CharacterProfile' can't be used to index type
'{ protagonist: string[]; antagonist: string[]; mentor: string[]; ... }'
```

Fungsi `getDialogueTemplates(archetype: CharacterProfile['archetype'], ...)` menerima union tipe archetype yang lebih luas daripada key yang tersedia di objek `baseTemplates` — celah keamanan tipe yang bisa menyebabkan runtime bug jika ada archetype baru ditambahkan ke `CharacterProfile` tapi lupa ditambahkan ke template.

---

### 5. 12 file skill baru = dead code, tidak pernah dipakai

Folder-folder berikut ditambahkan di commit terakhir tapi **tidak pernah diimpor di manapun** — tidak di `skills/registry.ts`, tidak di `index.ts`, tidak di file lain:

- `skills/character/` — arc-progression.ts, relationship-mapper.ts, trait-enforcer.ts, voice-consistency.ts
- `skills/environment/` — continuity-guard.ts, culture-validator.ts, geography-checker.ts, lore-keeper.ts
- `skills/writing/` — action-writer.ts, dialogue-writer.ts, pacing-controller.ts, screenplay-formatter.ts

Sementara kategori lain (`property/`, `camera/`, `audit/`, `prompting/`) sudah benar ter-registrasi di `skills/registry.ts` dan/atau di-export dari `index.ts`.

**Rekomendasi:** kalau memang belum siap dipakai, tandai jelas sebagai WIP (atau taruh di folder terpisah) supaya tidak dikira fitur aktif — dan supaya errornya (poin 4) tidak menghalangi build paket lain yang sudah siap pakai.

---

### 6. Script lint `engine-v2` cuma cover 6 file lama

Script `lint` di `engine-v2/package.json` hanya menyebut file lama (`index.ts, context.ts, generate.ts, types.ts, validate.ts, commands.ts`). Seluruh folder baru (`bible/`, `generate/`, `plan/`, `skills/` — puluhan file) **tidak pernah dilint sama sekali**, meski tercakup oleh `typecheck` (`tsc --noEmit` di seluruh `src/**`).

**Fix:** ganti ke `eslint 'src/**/*.ts' --config ...` supaya semua file baru ikut ter-cover.

---

### 7. Duplikasi & version-mismatch dependency di root `package.json`

Root `package.json` mendeklarasikan dependency yang seharusnya milik `apps/web`:

```json
// root package.json
"dependencies": {
  "@auth/prisma-adapter": "^2.11.3",
  "@prisma/client": "^5.10.0",
  "@tanstack/react-query": "^5.101.4",
  "next-auth": "5.0.0-beta.32",
  "react-hook-form": "^7.83.0",
  "zod": "^3.22.4",
  "zustand": "^5.0.14"
}
```

Masalahnya:
- **Version mismatch `next-auth`**: root pakai `5.0.0-beta.32`, sedangkan `apps/web/package.json` mendeklarasikan `^5.0.0-beta.15` — dua versi berbeda untuk paket yang sama.
- **Dependency tidak terpakai**: `zustand`, `react-hook-form`, `@tanstack/react-query` ada di root tapi **tidak muncul sama sekali** di `apps/web/package.json` — tidak jelas siapa yang mengimpor mereka, dan kalau `apps/web` butuh, harusnya dideklarasikan di sana, bukan di root.

**Fix:** pindahkan dependency yang spesifik untuk `apps/web` ke `apps/web/package.json`, samakan versi `next-auth`, dan root cukup berisi tooling bersama (husky, lint-staged, typescript).

---

## Yang Sudah Baik

- `packages/shared`, `packages/templates/universe`, `packages/config` **masing-masing** typecheck bersih secara individual — error baru muncul ketika `engine-v2` mencoba mengimpor `shared` (efek domino dari bug #1).
- Struktur folder monorepo secara konsep rapi dan konsisten dengan visi arsitektur di `README.md`.
- `apps/cli/tsconfig.json` sudah benar (`rootDir: "src"`) — jadikan referensi untuk memperbaiki paket lain.
- Prisma schema `apps/web/prisma/schema.prisma` terlihat solid — relasi `User`/`Account`/`Session`/`Universe`/`Review`/`GenerationJob` masuk akal untuk kebutuhan NextAuth + multi-user universe platform.
- Kategori skill `property/`, `camera/`, `audit/`, `prompting/` sudah benar ter-registrasi dan wired ke sistem, menunjukkan sebagian besar implementasi "skill system" ini memang berfungsi, hanya belum lolos type-check.

---

## Prioritas Perbaikan (urutan disarankan)

1. **Fix `rootDir` di 4 tsconfig** (shared, engine-v2, templates/universe, config) — ini blocker utama, semua yang lain tidak bisa diverifikasi sampai build jalan.
2. **Hapus hardcoded path Windows** di `engine-v2/package.json` lint script.
3. **Perbaiki 24 error TypeScript** di `src/skills/**`, `src/bible/**`, `src/generate/**`, `src/plan/**` (implicit any + bug archetype indexing di `dialogue-writer.ts`).
4. **Putuskan nasib 12 file skill orphan** — wire ke registry atau tandai eksplisit sebagai belum aktif.
5. **Tambahkan minimal test coverage** — bahkan smoke test sederhana per paket lebih baik daripada nol.
6. **Perluas cakupan lint script** `engine-v2` ke seluruh `src/**`.
7. **Bersihkan duplikasi dependency** di root `package.json`, samakan versi `next-auth`.

---

*Laporan ini dibuat berdasarkan eksekusi langsung `pnpm install`, `pnpm -r build`, `pnpm -r lint`, `pnpm -r test`, dan inspeksi kode di commit `e0cdba6`, bukan hanya pembacaan dokumentasi repo.*