# SPMB Fila

Sistem Penerimaan Murid Baru **SDIT Fitrah Insani Langkapura**. Satu aplikasi
Next.js melayani frontend wali/admin, Server Actions, dan API backend.
Database, Auth dan Storage menggunakan Supabase; pembayaran pendaftaran
mendukung Midtrans Snap atau transfer manual, sedangkan DU tetap manual.

## Status project

Audit repository **7 September 2026**: implementasi cakupan Phase 0–11 tersedia,
termasuk multi-anak, kuota/matrix biaya, enrollment, CMS, assessment/pengumuman,
TCP fallback FIFO dan pilihan kelas final, DU/konfirmasi WA, penghapusan dengan
retention, serta laporan CSV/XLSX. Ketersediaan kode bukan bukti kesiapan live.
Status database remote, deployment, SMTP dan merchant Production belum
diverifikasi dalam audit ini. Phase 12 Production masih memerlukan validasi.

Sumber keputusan: [Final Decisions dan specification](docs/SPMB-FILA-SPEC.md).
Panduan kontribusi, struktur folder, aturan bisnis, known issues dan next task:
[AGENTS.md](AGENTS.md). Referensi tambahan:
[test matrix](docs/PHASE11_TEST_MATRIX.md),
[Midtrans checklist](docs/MIDTRANS_SANDBOX_CHECKLIST.md),
[roadmap](docs/MVP_Roadmap_dan_ENV_Checklist.md).
Jika dokumen lama berbeda, gunakan Final Decisions.

## Dependency dan prasyarat komputer baru

- Git dan akses repository.
- Node.js **>=20.19 dan <25** sesuai `package.json` (audit memakai 24.15.0).
- npm **11.12.1** sesuai `packageManager`; dependency dikunci `package-lock.json`.
- Project Supabase development/staging dengan PostgreSQL, Auth Email dan Storage.
  Migration bergantung pada schema `auth.users` Supabase; PostgreSQL kosong biasa
  tanpa layanan/schema Supabase tidak cukup. Tidak ada setup Docker/Supabase CLI
  lokal yang disediakan repository.
- Akses database pooled dan direct, serta akses konfigurasi Auth/Storage.
- Akun Midtrans Sandbox untuk menguji Snap; konfigurasi SMTP/email Supabase untuk
  konfirmasi akun dan recovery.
- Vercel dan domain untuk deployment; tidak diperlukan untuk menjalankan UI lokal.

Stack utama: Next.js 16.3.3, React 19.2.8, TypeScript strict, Tailwind CSS 4,
Prisma 7.10.0 + adapter-pg, Supabase SSR/JS, Zod 4 dan ExcelJS 4.4.0.
Dependency test: Vitest 4.1.11, Playwright 1.62.1 dan ESLint 9.
Seluruhnya diinstal oleh npm; tidak ada service Express atau Prisma Composer
terpisah yang perlu dijalankan.

## 1. Clone dan install

```bash
git clone <URL_REPOSITORY> spmb-fila
cd spmb-fila
node --version
npm --version
```

Salin template environment (jangan menimpa file lokal yang sudah diisi):

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS/Linux
cp .env.example .env.local
```

Isi `.env.local` menggunakan dashboard layanan atau penyimpanan credential tim,
lalu install dependency sesuai lockfile:

```bash
npm ci
```

`postinstall` menjalankan `prisma generate` dan membuat `generated/prisma`.
Generate tidak membutuhkan koneksi database. Jangan mengedit output generated.

## 2. Environment variable

Template: [.env.example](.env.example). Nilai contoh harus diganti; README ini
tidak memuat credential. Kontrak aktual ada di `lib/env/schema.ts`.

| Variable | Kebutuhan / sumber |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Wajib: URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Wajib: publishable key project yang sama; tersedia di browser |
| `SUPABASE_SECRET_KEY` | Server-only: secret key Supabase untuk admin Auth/Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternatif legacy untuk secret key di atas; isi salah satu, utamakan `SUPABASE_SECRET_KEY` |
| `DATABASE_URL` | Wajib server-only: PostgreSQL pooled connection untuk runtime, contoh bentuk port 6543 dengan `pgbouncer=true` |
| `DIRECT_URL` | Wajib server-only: direct connection PostgreSQL untuk Prisma CLI/migration (umumnya port 5432) |
| `SUPABASE_STORAGE_BUCKET_PEMBAYARAN` | Wajib: nama bucket private, default template `bukti-pembayaran` |
| `SUPABASE_STORAGE_BUCKET_CMS` | Wajib: nama bucket public, default template `konten-cms` |
| `NEXT_PUBLIC_APP_URL` | Wajib: origin aplikasi tanpa path; lokal `http://localhost:3000` |
| `MIDTRANS_MERCHANT_ID` | ID merchant environment yang digunakan |
| `MIDTRANS_SERVER_KEY` | Server-only: server key Midtrans Sandbox untuk lokal/staging |
| `MIDTRANS_CLIENT_KEY` | Client key Midtrans dari environment yang sama |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Wajib sama persis dengan `MIDTRANS_CLIENT_KEY`; tersedia di browser |
| `MIDTRANS_IS_PRODUCTION` | Isi `false` di lokal/staging; `true` hanya untuk live setelah gate Production |
| `MIDTRANS_NOTIFICATION_URL` | Opsional: override webhook HTTPS publik, misalnya endpoint Preview untuk Sandbox |
| `VERCEL_ENV` | Disediakan Vercel (`development`, `preview`, `production`); tidak perlu dipalsukan di lokal |
| `NODE_ENV` | Dikelola Next.js/runtime; tidak perlu diisi manual |

Lengkapi variable Midtrans juga pada setup mode manual: beberapa bagian aplikasi
masih memvalidasi environment server lengkap. Nama `NEXT_PUBLIC_SUPABASE_ANON_KEY`
dari dokumen lama tidak dibaca implementasi sekarang.

Jangan memberi prefix `NEXT_PUBLIC_` pada secret/server key atau database URL.
Jangan commit `.env.local`, salin credential ke source, atau mencetak environment
ke log. Gunakan nilai terpisah untuk staging dan production. URL database dari
Supabase harus dapat dijangkau komputer/runtime; password di connection string
perlu URL-encoding bila mengandung karakter khusus.

## 3. Database setup

Schema: `prisma/schema.prisma`; seluruh SQL incremental ada di `prisma/migrations`.
Migration mencakup tabel domain, RLS, trigger profile Supabase Auth, retention
pembayaran dan constraint kuota/status. Migration terakhir:
`20260905100000_allow_released_tcp_queue`.

**Prisma CLI tidak otomatis membaca `.env.local`.** `prisma.config.ts` memakai
`dotenv/config`, yang default-nya membaca `.env`. Muat file lokal secara eksplisit
saat menjalankan command CLI berikut (berlaku PowerShell maupun bash):

```bash
node --env-file=.env.local node_modules/prisma/build/index.js validate
node --env-file=.env.local node_modules/prisma/build/index.js migrate status
node --env-file=.env.local node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.local node_modules/prisma/build/index.js db seed
```

Jika environment sudah disediakan shell/CI, gunakan script padanannya:

```bash
npm run prisma:validate
npm run prisma:migrate:deploy
npm run prisma:seed
```

Pastikan `DIRECT_URL` dan `DATABASE_URL` mengarah ke project yang sama. Terapkan
migration pada staging dahulu. `migrate deploy` hanya menerapkan migration;
`npm run build` tidak melakukan migration atau seed. Jangan mengganti riwayat SQL
ini dengan `db push` atau reset database berisi data.

Seed development menyiapkan mode awal `MIDTRANS`, jalur Reguler/TCP/Pindahan,
dua kategori, sembilan field Data Pribadi dan sepuluh field Observasi.
**Observasi 3–10 masih placeholder** dan wajib diselesaikan panitia melalui
`/admin/form-builder`. Seed belum mengisi matrix biaya, rekening sekolah, konten
operasional atau akun admin. Seed menggunakan upsert, tetapi rerun dapat
memperbarui flag jalur dan properti field; jangan menjalankannya otomatis pada
production yang sudah dikustomisasi.

`npm run prisma:verify-migration` adalah pengujian constraint/RLS di staging:
script membuat schema sementara, menerapkan subset migration dan memasukkan fixture
dalam transaksi lalu rollback. Verifier belum mencakup migration pilihan kelas
final TCP tanggal 5 September; gunakan integration final-route-choice dan
`migrate status` untuk pemeriksaan terkait. Ini bukan perintah
untuk menerapkan migration atau inspeksi read-only production.

## 4. Storage dan Supabase Auth

Sesudah environment lengkap, siapkan bucket:

```bash
npm run storage:ensure-buckets
```

Script membaca `.env.local` dan membuat **atau memperbarui** konfigurasi bucket:

| Bucket | Akses | Batas dan format |
|---|---|---|
| Pembayaran | Private, bukti diakses melalui signed URL | 5 MB, JPG/PNG/PDF; upload pendaftaran dibatasi lagi oleh aplikasi menjadi 500 KB |
| CMS | Public | 5 MB, JPG/PNG/WebP |

Aktifkan provider Email dan **Confirm Email** pada Supabase Auth. Aplikasi menolak
aktivasi signup yang langsung menghasilkan session tanpa konfirmasi.
Atur Site URL sama dengan `NEXT_PUBLIC_APP_URL` (tanpa `/register` atau path lain),
dan daftarkan Redirect URLs lokal berikut beserta padanan domain deployment:

```text
http://localhost:3000/auth/confirm
http://localhost:3000/auth/callback
```

Konfigurasikan SMTP/email delivery untuk signup dan recovery. Template **Confirm
signup** memakai:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Konfirmasi email</a>
```

Template **Reset password/Recovery** memakai:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

`/auth/confirm` menampilkan tombol konfirmasi, lalu memverifikasi OTP melalui POST
untuk mencegah email scanner menghabiskan tautan sekali pakai. Signup berakhir
di login; recovery mempertahankan session sampai password baru disimpan.
Jika email tidak sampai, cek Auth Logs, delivery/suppression SMTP dan spam;
nonaktifkan link tracking penyedia SMTP.

Daftar dan konfirmasi akun calon admin melalui aplikasi, lalu beri role eksplisit:

```bash
npm run auth:set-admin -- admin@example.com
```

Gunakan email akun sebenarnya, bukan contoh di atas. Role default dari trigger
adalah wali murid; metadata client tidak boleh menentukan role. Akun dan role
admin perlu dibuat lagi jika production memakai project Supabase berbeda.

## 5. Menjalankan frontend dan backend

```bash
npm run dev
```

Buka [aplikasi lokal](http://localhost:3000). Frontend dan backend berjalan pada
proses/port yang sama; `/api/*` adalah Next.js Route Handlers, dan Server Actions
berada bersama halaman. Supabase merupakan layanan eksternal yang harus aktif.

| Halaman | Fungsi |
|---|---|
| `/`, `/register`, `/login` | Beranda CMS dan auth wali |
| `/dashboard`, `/anak/tambah` | Dashboard multi-anak dan pendaftaran |
| `/anak/:id/*` | Kategori, bayar, enrollment, assessment, pengumuman, DU, join WA |
| `/admin/login`, `/admin/dashboard` | Akses admin |
| `/admin/jalur`, `/admin/kategori`, `/admin/biaya-pendaftaran` | Master data dan kuota/matrix biaya |
| `/admin/settings` | Mode pembayaran dan rekening sekolah |
| `/admin/form-builder`, `/admin/konten/beranda` | Form dan CMS (konten tahap lain berada di `/admin/konten/:tahap`) |
| `/admin/peserta`, `/admin/wali-murid`, `/admin/laporan` | Operasional, penghapusan dan laporan |

Sebelum mencoba pendaftaran, admin perlu mengisi kuota/periode/keaktifan,
matrix biaya untuk kombinasi jalur-kategori, field dan konten tahap.
Mode manual memerlukan minimal satu rekening; upload valid maksimal 500 KB
langsung memverifikasi pendaftaran. DU berbeda: upload maksimal 5 MB tetap
menunggu pemeriksaan admin dan nominal aktual.

Untuk Snap, gunakan key/merchant Sandbox dan `MIDTRANS_IS_PRODUCTION=false`.
Webhook berada di `POST /api/webhooks/midtrans`. Midtrans membutuhkan URL HTTPS
publik; localhost tidak menerima notifikasi internet secara langsung. Gunakan
Preview staging dan atur Payment Notification URL di dashboard atau
`MIDTRANS_NOTIFICATION_URL`. Callback browser tidak menentukan status final.
Lihat [checklist Sandbox](docs/MIDTRANS_SANDBOX_CHECKLIST.md).

## 6. Test dan pemeriksaan kualitas

```bash
npm run lint
npm run typecheck
npm test
npm run build
# Gabungan keempat command:
npm run check
```

Unit test tidak membutuhkan layanan remote. Build membutuhkan environment yang
valid dan dapat bergantung pada akses resource eksternal. Untuk menjalankan
hasil build secara lokal:

```bash
npm start
```

Integration/E2E **menulis dan membersihkan fixture staging**, menggunakan Auth,
PostgreSQL, Storage dan sebagian transaksi Snap Sandbox nyata. Jangan jalankan
terhadap production. Siapkan environment staging lengkap, build dan port 3000:

```bash
npm run test:e2e:install
npm run build
npm run test:integration
npm run test:e2e
# Atau seluruh quality gate dari lint sampai browser:
npm run test:phase11
```

Runner Phase 11 menyalakan/memakai server `127.0.0.1:3000`, memverifikasi migration,
menjalankan auth, Phase 3–10, dynamic payment, final route choice, admin deletion,
lalu E2E Chromium viewport 390×844. E2E adalah smoke routing/auth/dashboard/laporan,
bukan seluruh perjalanan pendaftaran di browser. Jika server sudah aktif,
pastikan environment-nya sama; runner dapat menggunakannya kembali.

Suite individual tersedia di `package.json`: `test:auth-integration`,
`test:phase3-integration` sampai `test:phase10-integration`,
`test:dynamic-payment-integration`, `test:final-route-choice-integration`,
dan `test:admin-deletion-integration`. Untuk suite HTTP individual, jalankan
server staging lokal terlebih dahulu. Detail risiko ada di
[test matrix](docs/PHASE11_TEST_MATRIX.md).
Artifact `test-results/` dan `playwright-report/` diabaikan Git; jangan bagikan
trace/screenshot berisi PII atau data nyata.

## 7. Build dan deployment

Target desain adalah **Vercel**. Repository tidak menyimpan `vercel.json`,
workflow CI/CD, atau bukti deployment aktif. Alur berikut memakai script aktual:

1. Import repository ke Vercel dengan framework Next.js dan root repository.
   Gunakan Node dalam rentang engine project dan install `npm ci`.
2. Set environment **Preview → Supabase staging + Midtrans Sandbox** dan
   **Production → Supabase production + key merchant Production**. Set origin
   `NEXT_PUBLIC_APP_URL` sesuai deployment, plus redirect Auth/domain dan SMTP.
3. Terapkan migration dengan `DIRECT_URL` target melalui proses release terkontrol
   sebelum aplikasi menggunakan schema baru. Build command: `npm run build`.
   Jangan menambahkan migration/seed otomatis ke setiap Preview build.
4. Siapkan bucket, akun admin dan konfigurasi operasional pada setiap project.
   Periksa kuota/matrix biaya/form/konten sebelum membuka pendaftaran.
5. Untuk Midtrans live, verifikasi merchant disetujui, metode pembayaran aktif,
   key tidak tertukar, dan webhook HTTPS pada domain production. Aktifkan
   `MIDTRANS_IS_PRODUCTION=true` hanya setelah gate
   [Production](docs/MIDTRANS_SANDBOX_CHECKLIST.md) dipenuhi.
6. Jalankan smoke test yang dikoordinasikan dengan sekolah, termasuk nominal,
   notifikasi webhook, status, Auth dan akses bukti. Jangan menjalankan suite
   fixture staging pada production.

`NEXT_PUBLIC_*` masuk ke bundle saat build: perubahan nilai publik memerlukan
build/deployment baru. Frontend dan backend dideploy bersama oleh Next.js;
tidak ada deployment service backend kedua. Hosting Node lain dapat menjalankan
`npm run build` lalu `npm start`, tetapi konfigurasi production non-Vercel belum
tervalidasi oleh audit ini.

## Known issues dan hasil audit lokal

- Prisma CLI dan Next.js berbeda dalam memuat environment; gunakan command
  `node --env-file` di bagian database jika muncul `DIRECT_URL` tidak tersedia.
- Seed observasi 3–10 belum final; mode pembayaran awal adalah Midtrans dan
  matrix/rekening/konten perlu diisi admin.
- Guard environment Midtrans hanya menolak production pada `VERCEL_ENV`
  non-production yang terisi. Jika variable tidak ada, `true` masih diterima
  schema; jangan mengandalkan guard itu untuk isolasi lingkungan lokal.
- Penghapusan akun wali yang gagal di Supabase Auth meninggalkan akun nonaktif
  agar dapat dicoba ulang; penghapusan Auth dan transaksi DB tidak atomik bersama.
- Pada komputer audit, launcher `npm` mengarah ke npm CLI global yang hilang.
  Ini masalah instalasi/PATH lokal; pastikan `npm --version` berfungsi pada
  komputer baru. Pemeriksaan audit memakai CLI dependency langsung.
- Hasil audit lokal: **lint, typecheck, 29 file / 132 unit test dan Next.js build
  lulus**, memakai dependency/Prisma Client yang sudah terpasang. Fresh `npm ci`
  dan postinstall generate tidak diuji ulang. Integration/E2E,
  migration remote dan deployment tidak dijalankan pada audit dokumentasi ini.

Pekerjaan berikutnya: quality gate staging lengkap, finalisasi konten panitia,
peninjauan guard environment Midtrans, lalu verifikasi kesiapan Phase 12.
Lihat [AGENTS.md](AGENTS.md) untuk batas scope dan aturan perubahan.
