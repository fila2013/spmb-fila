# AGENTS.md — SPMB Fila

## Identitas dan sumber keputusan

SPMB Fila adalah Sistem Penerimaan Murid Baru SDIT Fitrah Insani Langkapura.
Audit dokumentasi: **7 September 2026**, berdasarkan source, konfigurasi, migration,
dan test repository. Status implementasi di bawah tidak membuktikan deployment
atau migration sudah diterapkan pada database remote.

Baca [specification](docs/SPMB-FILA-SPEC.md), terutama **Final Decisions**, sebelum
mengubah domain. Dokumen pendukung: `docs/TECHNICAL_SPEC.md`,
`docs/MVP_Roadmap_dan_ENV_Checklist.md`, `docs/PRD_SPMB_SDIT_Fitrah_Insani.md`,
dan `docs/wireframe.html`. Keputusan final terbaru mengatasi dokumen desain lama.
Jangan mengarang business rule; konflik yang memengaruhi pembayaran, kuota,
authorization, schema, atau delete harus diklarifikasi sebelum implementasi.

## Stack dan arsitektur aktual

- Next.js **16.3.3**, App Router, React **19.2.8**, React Compiler aktif.
- TypeScript strict, alias `@/*` ke root; Tailwind CSS 4, Lucide, clsx/tailwind-merge.
- Prisma **7.10.0**, `@prisma/adapter-pg` dan `pg`; PostgreSQL di Supabase.
- Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`) dan Storage.
- Zod 4 untuk validasi; ExcelJS untuk ekspor XLSX.
- Midtrans Snap melalui `fetch` server-side; Snap.js pada browser.
- Vitest 4.1.11, Playwright 1.62.1 (Chromium), ESLint 9.
- Node `>=20.19 <25`; package manager `npm@11.12.1`, lockfile npm.
- Target hosting Vercel; tidak ada backend terpisah, Docker setup, atau workflow
  CI yang disimpan dalam repository. Prisma Composer bukan runtime aplikasi ini.

```text
Browser → Next.js pages / Client Components
        → Server Components / Server Actions / Route Handlers
        → lib/<domain>/service.ts → Prisma + adapter-pg → Supabase PostgreSQL
                                 → Supabase Auth / Storage
                                 → Midtrans Snap API
Midtrans → POST /api/webhooks/midtrans → payment service → PostgreSQL
```

`proxy.ts` memperbarui cookie session dan menangani variasi redirect auth.
Proxy bukan authorization bisnis. `lib/auth/session.ts` memvalidasi claims,
profile aktif, role, dan ownership pada server. Profile aplikasi `users`
terhubung ke `auth.users` melalui UUID Supabase; migration memasang trigger sync.
Prisma memakai `DATABASE_URL` untuk runtime, sedangkan Prisma CLI menggunakan
`DIRECT_URL` dari `prisma.config.ts`. Client dihasilkan ke `generated/prisma`.

## Struktur folder

| Lokasi | Tanggung jawab |
|---|---|
| `app/(auth)`, `app/auth` | Register/login/reset password, callback dan konfirmasi email dua langkah |
| `app/dashboard`, `app/anak` | Dashboard wali dan alur pendaftaran per anak |
| `app/admin` | Dashboard, master data, peserta/wali, form builder, CMS, pembayaran, laporan; Server Actions dalam route groups |
| `app/api` | Route Handlers wali/admin dan webhook Midtrans |
| `components` | UI per domain: auth, admin, calon-murid, payment, enrollment, stages, admission |
| `lib/auth`, `lib/supabase`, `lib/env`, `lib/prisma.ts` | Auth, client layanan, validasi environment, akses database |
| `lib/master-data`, `lib/calon-murid` | Jalur/kategori/biaya, ownership dan alokasi kuota |
| `lib/payment`, `lib/payment-settings` | Snap/webhook, transfer manual, bukti dan rekening sekolah |
| `lib/enrollment`, `lib/stages`, `lib/admission` | Form, CMS/assessment/pengumuman, DU dan konfirmasi WA |
| `lib/fallback`, `lib/final-route-choice`, `lib/admin-deletion` | FIFO, pilihan kelas TCP, penghapusan dan retention |
| `lib/reporting` | Filter, pemetaan data, CSV/XLSX dan audit ekspor |
| `prisma` | Schema, migration SQL, seed dan verifier constraint/RLS |
| `scripts` | Integration test, runner Phase 11, bootstrap admin/Storage |
| `e2e` | Smoke browser mobile dan fixture staging |
| `docs`, `public` | Requirement/checklist/wireframe dan asset statis |
| `generated/prisma`, `.next` | Output generated/build, diabaikan Git; jangan edit manual |

Domain umumnya memisahkan `service.ts`, `rules.ts`, `schemas.ts`, `http.ts`,
`errors.ts`, dan test yang berdekatan. Reuse domain logic dari action/route;
jangan menaruh business rule kompleks di komponen UI.

## Command development dan verifikasi

Setup lengkap dan pemuatan `.env.local` untuk Prisma CLI ada di [README](README.md).

| Command | Fungsi |
|---|---|
| `npm ci` | Install sesuai lockfile; postinstall menjalankan Prisma generate |
| `npm run dev` | Frontend dan backend Next.js di port 3000 |
| `npm run build` / `npm start` | Generate Prisma + build; menjalankan hasil build |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, TypeScript, unit test |
| `npm run test:watch` | Vitest watch |
| `npm run check` | Lint → typecheck → unit → build |
| `npm run prisma:validate` | Validasi schema tanpa migration |
| `npm run prisma:format` | Memformat schema; gunakan hanya bila schema memang diubah |
| `npm run prisma:migrate:deploy` | Menerapkan migration existing pada database target |
| `npm run prisma:seed` | Seed development; dapat memperbarui field/config existing |
| `npm run storage:ensure-buckets` | Membuat/memperbarui konfigurasi bucket Supabase |
| `npm run auth:set-admin -- email@example.com` | Memberi role admin pada akun yang sudah dibuat |
| `npm run prisma:verify-migration` | Uji database staging dengan transaksi yang di-rollback |
| `npm run test:integration` | Runner seluruh integration, perlu build dan staging |
| `npm run test:e2e:install` / `npm run test:e2e` | Install Chromium / smoke browser, perlu build dan staging |
| `npm run test:phase11` | Check lokal, build, migration verification, integration dan E2E |

Integration individual: `test:auth-integration`, `test:phase3-integration` sampai
`test:phase10-integration`, `test:dynamic-payment-integration`,
`test:final-route-choice-integration`, `test:admin-deletion-integration`.
Runner `scripts/run-phase11.mjs` mencakup seluruh suite tersebut, menggunakan
`127.0.0.1:3000`, dan dapat memakai server yang sudah aktif; pastikan server
itu memakai environment staging yang sama.

## Aturan penting

### Auth, data dan secrets

- Supabase Auth wajib; tidak boleh membuat password hashing/auth manual.
- Validasi session, profile aktif, role, ownership dan input di server. Jangan
  percaya `user_id`, role metadata, nominal, atau kuota terpakai dari client.
- `SUPABASE_SECRET_KEY` (fallback `SUPABASE_SERVICE_ROLE_KEY`), database URL,
  dan `MIDTRANS_SERVER_KEY` hanya server-side; jangan log/commit/expose ke browser.
- Gunakan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; nama anon key pada dokumen
  lama bukan environment yang dibaca implementasi sekarang.
- Konfirmasi email wajib aktif. Role awal selalu wali; promosi admin eksplisit.
- Gunakan Zod dan kontrak error domain; jangan expose internal error atau PII
  yang tidak diperlukan. Bukti pembayaran private, akses melalui signed URL.

### Pembayaran dan status gate

- Nominal pendaftaran berasal dari `Jalur × Kategori → biaya_pendaftaran.nominal`.
  Bila matrix aktif belum tersedia, jangan buat transaksi atau buka Snap.
- Admin memilih `MIDTRANS`/`MANUAL` di `/admin/settings`; mode manual memerlukan
  minimal satu rekening sekolah. Upload JPG/PNG/PDF maksimal **500 KB** yang valid
  langsung `VERIFIED` dan membuka enrollment, tanpa verifikasi admin.
- Snap token dibuat server-side. Hasil final Midtrans hanya dari webhook:
  signature SHA-512, merchant dan nominal harus sesuai; idempotent dan
  `midtrans_order_id` unique. Callback browser bukan bukti pembayaran.
- `POST /api/webhooks/midtrans` tidak memerlukan session dan dikecualikan proxy.
- Local/Preview wajib Sandbox (`MIDTRANS_IS_PRODUCTION=false`). Production
  mengikuti gate merchant/domain/smoke test di checklist Midtrans.
- Enrollment wajib payment `VERIFIED`; submit final memvalidasi kedua form dan
  mengunci jawaban. Pengumuman tidak boleh membocorkan hasil sebelum tanggal
  rilis Asia/Jakarta. DU menunggu diterima dan penyelesaian pilihan kelas bila aktif.
- DU tetap manual: bukti maksimal **5 MB**, preview/verifikasi admin dan nominal
  aktual dari admin. Setelah verified, admin menyediakan link WA; wali membuka
  link lalu mengonfirmasi bergabung untuk mengubah status ke `SELESAI`.

### Kuota, fallback, pilihan kelas dan penghapusan

- Semua alokasi/perubahan kuota, auto-transfer, pilihan final dan reprocess FIFO
  harus atomik melalui transaction + row locking/strategi setara. Jangan
  mengandalkan pengecekan frontend; pertahankan constraint SQL custom.
- TCP gagal → Reguler tersedia: langsung diterima tanpa asesmen/pembayaran ulang.
  Jika penuh: `MENUNGGU_KUOTA_FALLBACK`, FIFO berdasarkan `created_at`.
  Tambah kuota memicu reprocess; admin juga dapat memproses manual.
- Pilihan final TCP diterima bersifat opsional per jalur, berlaku semua kategori.
  Jika aktif, wali wajib memilih sekali sebelum DU. Pilih Reguler langsung
  melepas kuota TCP; bila penuh masuk FIFO tanpa kembali menahan kuota TCP.
- Auto-delete Reguler/Pindahan dengan `hapus_data_jika_gagal=true` memerlukan
  konfirmasi admin dan audit snapshot sebelum delete. Hanya anak gagal itu
  yang dihapus; akun wali dan anak lain tetap.
- Penghapusan peserta manual admin adalah operasi terpisah. Penghapusan akun
  wali hanya boleh setelah tidak ada anak, dengan konfirmasi eksplisit;
  jangan mengubah auto-delete menjadi penghapusan akun otomatis.
- Ledger pembayaran dipertahankan dengan `ON DELETE SET NULL`, UUID referensi
  non-PII dan detail audit yang disanitasi. Hapus file bukti setelah pemeriksaan
  hanya menghapus object/path; transaksi, nominal, status dan audit tetap ada.

## Fitur yang sudah diimplementasikan

Source dan suite test tersedia untuk cakupan Phase 0–11:

- Fondasi schema/migration, RLS, trigger profile Auth, auth cookie, verifikasi
  email dua langkah, reset password dan role/ownership.
- Master jalur/kategori/kuota/periode, matrix biaya dan pendaftaran multi-anak.
- Snap/webhook/retry, pembayaran manual dinamis, rekening sekolah, preview dan
  penghapusan bukti dengan retention.
- Form builder sederhana, draft Data Pribadi/Observasi dan final enrollment.
- CMS beranda/YouTube, konten tahap, assessment/pengumuman dan tombol Calendar.
- TCP fallback FIFO, reprocess, pilihan kelas final, auto-delete serta pengelolaan
  penghapusan peserta/akun wali dengan audit.
- DU manual, tautan grup dan konfirmasi wali, laporan filter dan ekspor CSV/XLSX.
- Unit, integration staging dan smoke E2E Chromium mobile.

## Sedang dikerjakan / belum terverifikasi

Fresh setup pada checkout baru sudah dijalankan 7 September 2026. `npm ci`,
postinstall Prisma generate, lint, typecheck, 29 file / 132 unit test, dan build
dengan environment contoh lulus setelah script typecheck diperbaiki agar menjalankan
`next typegen` sebelum `tsc`. Checkout belum memiliki `.env.local`; validasi staging
dan **kesiapan Phase 12 Production** tetap menjadi pekerjaan berikutnya. Migration
terakhir adalah `20260905100000_allow_released_tcp_queue` setelah fitur pilihan kelas
final. Penerapan migration di staging/production, SMTP, konfigurasi bucket dan
merchant live perlu diverifikasi pada layanan masing-masing.

## Known issues dan batasan

- `prisma.config.ts` memakai `dotenv/config` (default `.env`), sedangkan Next.js
  dan banyak script memakai `.env.local`. Prisma CLI perlu environment dimuat
  eksplisit; lihat command README. Jangan menggandakan secret ke source.
- Seed observasi 3–10 masih placeholder. Seed tidak mengisi matrix biaya,
  rekening, konten operasional atau akun admin; konfigurasi tersebut wajib diisi.
  Rerun seed dapat menimpa properti field dan flag jalur existing.
- Guard Midtrans production menolak Preview/Development bila `VERCEL_ENV` ada,
  tetapi tidak menolak `true` bila variable itu tidak ada. Tetap gunakan false
  di lokal; jangan menganggap guard sebagai isolasi production menyeluruh.
- Penghapusan akun wali melibatkan PostgreSQL dan Supabase Auth secara terpisah.
  Jika Auth gagal, akun tetap nonaktif dan penghapusan perlu dicoba kembali.
- Verifier migration hanya menjalankan subset SQL dalam schema sementara dan
  belum memasukkan dua migration pilihan kelas final tanggal 5 September.
  Jangan menganggap verifier membuktikan seluruh migration sudah diterapkan;
  cek `migrate status` dan integration final-route-choice.
- Checklist lama masih memuat rencana production dan klaim historis yang belum
  diverifikasi ulang. E2E hanya smoke subset; bukan seluruh perjalanan browser.
- Audit lokal: fresh `npm ci` dan Prisma generate lulus; lint, typecheck, 29 file /
  132 unit test dan Next.js build juga lulus. Build memakai nilai dummy dari
  `.env.example` dan tidak membuktikan koneksi layanan. Integration/E2E remote tidak
  dijalankan; tidak ada klaim seluruh MVP lolos production.

## Next task (urutan yang disarankan)

1. Jalankan quality gate staging lengkap pada environment terisolasi setelah
   memastikan migration terbaru, Storage dan credential Sandbox sesuai.
2. Selesaikan konten/form observasi, kuota/periode, matrix biaya dan rekening
   bersama panitia; uji alur multi-anak sampai konfirmasi WA.
3. Tinjau guard environment Midtrans ketika `VERCEL_ENV` tidak ada dan sinkronkan
   checklist lama dengan Final Decisions; lakukan perubahan kode sebagai task terpisah.
4. Verifikasi Phase 12: Supabase/Vercel Production terpisah, Auth/SMTP/domain,
   merchant/webhook live, migration aman dan smoke test yang dikoordinasikan.

Phase 2 tetap ditunda: notifikasi otomatis, WhatsApp API, Bendahara/Asesor,
Midtrans DU, analytics, bulk import, multi-tenant, promo dan advanced form builder.

## Workflow dan Definition of Done

Understand → Plan → Implement satu perubahan → Test → Review diff → Report.
Baca guide Next.js lokal yang relevan sebelum coding. TypeScript strict; hindari
`any`; perubahan domain kritis wajib test (auth/ownership, race kuota, biaya,
webhook signature/idempotency/transisi, gate, fallback/FIFO/pilihan final,
auto-delete/retention dan multi-anak). Jalankan lint/typecheck/test relevan;
integration/E2E hanya staging, bukan data production. Verifier migration juga
menulis fixture dalam transaksi, sehingga bukan inspeksi database read-only.

Jangan edit migration yang sudah diterapkan atau melakukan perubahan destruktif
tanpa menjelaskan dampak. Jangan commit env/credential atau force-push tanpa
instruksi. Review `git diff`; laporkan hasil verifikasi, keterbatasan dan risiko.
Task selesai bila sesuai spec, authorization benar, tidak ada secret exposure,
check relevan lulus dan migration aman bila ada. Dokumentasi status harus
membedakan implementasi, hasil test lokal dan bukti operasi remote.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
