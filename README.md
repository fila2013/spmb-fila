# SPMB FILA

Sistem Penerimaan Murid Baru SDIT Fitrah Insani Langkapura.

Dokumen sumber keputusan:

- `docs/SPMB-FILA-SPEC.md`
- `docs/MVP_Roadmap_dan_ENV_Checklist.md`
- `docs/PRD_SPMB_SDIT_Fitrah_Insani.md`
- `docs/TECHNICAL_SPEC.md`
- `docs/wireframe.html`

Jika terdapat konflik, gunakan bagian **Final Decisions** pada
`docs/SPMB-FILA-SPEC.md` dan ikuti `AGENTS.md`.

## Status implementasi

Phase 0 sampai Phase 11 sudah selesai. Selain fondasi database, Supabase Auth,
master data, pendaftaran multi-anak, dan Midtrans Snap Sandbox, wali murid dapat
mengisi enrollment Data Pribadi serta Observasi secara bertahap. Submit final
dikunci oleh pembayaran terverifikasi dan memajukan status ke tahap asesmen.
Admin dapat mengelola konten assessment/announcement dan hasil individual;
keputusan final tidak terlihat oleh wali sebelum tanggal rilis Asia/Jakarta.
Fallback TCP ke Reguler, antrian FIFO, reprocess otomatis/manual, dan
auto-delete dengan retention pembayaran juga sudah aktif.
Peserta diterima dapat mengunggah bukti DU ke bucket private, admin dapat
memverifikasi/menolak bukti dan mencatat nominal aktual, lalu mengelola status
undangan grup WhatsApp secara manual.
Admin juga memiliki laporan peserta dengan filter lintas tahap serta ekspor
Excel/CSV yang tercatat di audit log.
Seluruh migration telah diterapkan ke database Supabase staging.

## Prasyarat

- Node.js 20.19 sampai sebelum 25
- npm 11
- Supabase project staging
- Nilai environment staging/sandbox

## Menjalankan project

1. Salin `.env.example` menjadi `.env.local`.
2. Isi nilai Supabase staging, database staging, dan Midtrans sandbox. Dua
   nilai publik Supabase yang diberikan sudah dapat dipakai di `.env.local`;
   secret dan password database tetap harus diisi secara lokal.
3. Install dependency dan generate Prisma Client:

   ```bash
   npm install
   ```

4. Jalankan development server:

   ```bash
   npm run dev
   ```

## Pemeriksaan kualitas

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Atau jalankan seluruh pemeriksaan:

```bash
npm run check
```

## Aturan environment

- `DATABASE_URL` memakai pooled connection untuk runtime serverless.
- `DIRECT_URL` memakai direct connection untuk Prisma migration.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` boleh digunakan di browser dengan RLS
  yang benar.
- `SUPABASE_SECRET_KEY` dan `MIDTRANS_SERVER_KEY` hanya server-side. Nama legacy
  `SUPABASE_SERVICE_ROLE_KEY` masih diterima sebagai fallback.
- Session Supabase berbasis cookie diperbarui melalui `proxy.ts`; authorization
  bisnis tetap divalidasi di server berdasarkan session, role, dan ownership.
- Midtrans production hanya boleh aktif di Vercel Production.
- `.env.local` dan file environment lain tidak boleh di-commit.
- `.env.example` hanya berisi nama variable dan nilai contoh non-production.

## Prisma

Schema domain berada di `prisma/schema.prisma`. Riwayat migration berada di
`prisma/migrations`.

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:verify-migration
npm run prisma:migrate:deploy
npm run prisma:seed
```

Seed bersifat idempotent dan menambahkan tiga jalur, dua kategori, sembilan field
data pribadi, serta sepuluh field observasi. Pertanyaan observasi nomor 3–10
masih berupa placeholder development dan harus diisi panitia melalui Form Builder.

Ledger pembayaran menggunakan `ON DELETE SET NULL`: penghapusan calon murid
melepas relasi aktif tetapi mempertahankan nominal, status, referensi transaksi,
dan UUID referensi non-PII untuk audit keuangan.

## Supabase Auth

Project menggunakan `@supabase/ssr` karena session Next.js disimpan dalam
cookie. Paket `@supabase/server` tidak diperlukan pada tahap ini karena paket
tersebut ditujukan untuk backend stateless yang menerima Bearer token melalui
header. Helper tersedia di `lib/supabase`, sedangkan `proxy.ts` memverifikasi dan
memperbarui token dengan `auth.getClaims()`.

Tambahkan URL berikut ke daftar **Redirect URLs** Supabase Auth untuk local:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
```

Tambahkan URL ekuivalen untuk domain preview/production dan set
`NEXT_PUBLIC_APP_URL` sesuai origin deployment. Konfirmasi email dan reset
password memerlukan konfigurasi email/SMTP Supabase yang aktif.

Pada **Authentication → Providers → Email**, opsi **Confirm Email** wajib aktif.
Jika Supabase mengembalikan session langsung saat signup, aplikasi membatalkan
aktivasi akun sebagai fail-safe. Untuk email yang tidak diterima, periksa Auth
Logs Supabase, log delivery/suppression penyedia SMTP, folder spam, dan pastikan
link tracking penyedia SMTP dinonaktifkan.

Untuk mencegah email scanner menghabiskan tautan sekali-pakai sebelum pengguna
menekannya, gunakan halaman konfirmasi dua langkah. Atur template **Confirm
signup** agar tombolnya menggunakan URL berikut:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">
  Konfirmasi email
</a>
```

Atur template **Reset password/Recovery** dengan pola berikut:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  Reset password
</a>
```

Aplikasi mengarahkan `RedirectTo` ke `/auth/confirm`. Endpoint tersebut hanya
menampilkan tombol; OTP baru diverifikasi melalui request POST setelah pengguna
menekan tombol. Setelah konfirmasi signup berhasil, session verifikasi ditutup
dan pengguna diarahkan ke halaman login. Session recovery tetap dipertahankan
hingga password baru selesai disimpan.

Trigger database membuat profile `users` dengan role `wali_murid`. Metadata Auth
yang dikirim client tidak pernah menjadi sumber role. Setelah calon admin membuat
dan mengonfirmasi akun, pemberian role awal dilakukan eksplisit dan tercatat:

```bash
npm run auth:set-admin -- admin@example.com
```

Uji integrasi trigger terhadap staging membuat dan membersihkan akun sementara:

```bash
npm run test:auth-integration
```

## Master Data Phase 3

Halaman admin tersedia di:

```text
/admin/dashboard
/admin/jalur
/admin/kategori
/admin/biaya-pendaftaran
```

API `GET/POST/PATCH` tersedia di bawah `/api/admin/jalur`,
`/api/admin/kategori`, dan `/api/admin/biaya-pendaftaran`. Semua endpoint
memverifikasi session serta role admin pada server. Kuota terpakai tidak diterima
sebagai input admin; perubahan batas kuota memakai row lock dan tidak boleh lebih
kecil dari pemakaian berjalan.

Smoke test staging membuat akun admin dan master data sementara melalui API,
memeriksa authorization serta audit log, lalu membersihkannya kembali:

```bash
npm run test:phase3-integration
```

Jika production memakai Supabase project/database yang berbeda dari staging,
akun Auth dan pemberian role admin harus dibuat ulang di production setelah
migration diterapkan. Role tidak berpindah otomatis antar-project.

## Pendaftaran Awal Phase 4

Dashboard wali murid tersedia di `/dashboard`. Alur awal menggunakan halaman
`/anak/tambah`, `/anak/:id/kategori`, lalu ringkasan persiapan pembayaran di
`/anak/:id/pembayaran-pendaftaran`. Endpoint JSON tersedia di:

```text
GET/POST /api/calon-murid
GET      /api/calon-murid/:id
PATCH    /api/calon-murid/:id/jalur
PATCH    /api/calon-murid/:id/kategori
```

Semua akses memverifikasi session, role wali murid, dan ownership. Kuota jalur
serta kategori dialokasikan di dalam transaction dengan row lock. Pemilihan
kategori hanya dapat diteruskan jika kombinasi biaya aktif tersedia; nominal
selalu dibaca oleh server dari database.

Smoke test staging mencakup race condition kuota, isolasi multi-child,
ownership, penolakan `userId` dari client, dan kategori tanpa biaya:

```bash
npm run test:phase4-integration
```

## Pembayaran Dinamis Phase 5

Phase 5 sementara dikunci ke Sandbox (`MIDTRANS_IS_PRODUCTION=false`) sampai
validasi merchant Production selesai. Detail konfigurasi dan skenario uji ada
di `docs/MIDTRANS_SANDBOX_CHECKLIST.md`.

Admin memilih mode pembayaran pendaftaran di `/admin/settings`: `MIDTRANS`
atau `MANUAL`. Mode manual membutuhkan minimal satu rekening sekolah. Bukti
JPG/PNG/PDF maksimal 500 KB disimpan di bucket privat `bukti-pembayaran` dan,
sesuai keputusan bisnis terbaru, langsung memverifikasi pembayaran serta
membuka enrollment tanpa verifikasi admin.

Endpoint pembayaran:

```text
POST /api/calon-murid/:id/pembayaran/midtrans/create
POST /api/calon-murid/:id/pembayaran/manual
GET  /api/calon-murid/:id/pembayaran
POST /api/webhooks/midtrans
GET/PATCH /api/admin/settings/payment
GET/POST  /api/admin/settings/bank-accounts
PATCH/DELETE /api/admin/settings/bank-accounts/:id
GET/DELETE /api/admin/pembayaran/:id/bukti
```

Create transaction memverifikasi session, role, ownership, status tahap, dan
mengambil nominal dari matrix biaya. Webhook tidak memakai session Supabase;
signature SHA-512, Merchant ID, dan nominal wajib cocok sebelum perubahan
status. Payload audit disanitasi dan tidak menyimpan signature, nomor VA, atau
detail instrumen pembayaran.

Setelah pembayaran manual selesai diperiksa, Admin dapat menghapus file bukti
pendaftaran maupun DU. Object Storage dan `file_bukti_url` dihapus, tetapi
record transaksi, nominal, status, serta audit keuangan tetap dipertahankan.

Smoke test melakukan request Snap nyata ke Sandbox, menguji idempotency,
ownership, invalid signature, amount/merchant mismatch, pending, settlement,
expire, retry attempt, polling status, dan enrollment transition:

```bash
npm run test:phase5-integration
npm run test:dynamic-payment-integration
```

## Enrollment Phase 6

Halaman wali murid:

```text
/anak/:id/enrollment/data-pribadi
/anak/:id/enrollment/observasi
```

Kontrak API:

```text
GET /api/enrollment/fields?form_type=data_pribadi&calon_murid_id=:id
GET /api/calon-murid/:id/enrollment
PUT /api/calon-murid/:id/enrollment
```

Semua read/write memverifikasi session, role wali murid, ownership, dan
pembayaran pendaftaran `VERIFIED`. Draft mengizinkan pengisian bertahap. Submit
final memvalidasi seluruh field wajib pada kedua form dalam transaction,
mengunci jawaban, lalu mengubah status calon murid menjadi `MENUNGGU_ASESMEN`.
Nilai jawaban tidak disalin ke audit log.

Admin mengelola field, tipe input, status wajib, urutan, validasi nomor WA, dan
auto-fill melalui `/admin/form-builder`. Field yang sudah memiliki jawaban tidak
dapat dihapus; tipe input/bagian form-nya juga tidak dapat diubah agar makna data
lama tetap terjaga.

Integration test staging mencakup payment gate, ownership, auto-fill email,
validasi nomor WA, draft, submit tidak lengkap, final submit, dan penguncian
pasca-submit:

```bash
npm run test:phase6-integration
```

## Assessment & Announcement Phase 7

Halaman wali murid:

```text
/anak/:id/assessment
/anak/:id/pengumuman
```

Admin mengelola peserta melalui `/admin/peserta` dan konten scoped per
jalur/kategori melalui `/admin/konten/assessment` serta
`/admin/konten/announcement`. Gambar CMS disimpan di bucket
`SUPABASE_STORAGE_BUCKET_CMS`, dengan validasi JPG/PNG/WebP maksimal 5 MB.

Hasil assessment memajukan peserta ke `MENUNGGU_PENGUMUMAN`. Keputusan
announcement disimpan per anak dan hanya dikembalikan backend pada atau setelah
tanggal rilis kalender Asia/Jakarta. Keputusan gagal selanjutnya diproses oleh
aturan fallback atau auto-delete Phase 8.

Integration test staging memeriksa role, ownership, CMS scope, transisi status,
release gate tanpa kebocoran hasil/konten, audit log, dan dependency Phase 8:

```bash
npm run test:phase7-integration
```

## Fallback, FIFO & Auto-delete Phase 8

Jalur dengan `fallback_jalur_id` memindahkan peserta yang tidak diterima ke
jalur tujuan secara atomik. Jika kuota tersedia, peserta langsung diterima
tanpa assessment atau pembayaran ulang. Jika penuh, peserta masuk status
`MENUNGGU_KUOTA_FALLBACK` dan diproses FIFO berdasarkan `created_at`.

Admin dapat melihat dan memproses ulang antrian dari `/admin/jalur`. Penambahan
`kuota_maks` juga memicu reprocess otomatis. Kontrak API operasional:

```text
GET  /api/admin/jalur/:id/antrian-fallback
POST /api/admin/jalur/:id/proses-ulang-antrian
```

Auto-delete memerlukan frasa konfirmasi `HAPUS <nama anak>`. Snapshot minimum
disimpan ke audit log sebelum delete. Akun wali dan anak lain tidak disentuh;
baris pembayaran tetap disimpan dengan `calon_murid_id = NULL`, sementara UUID
referensi, nominal, metode, status, referensi Midtrans, dan timestamp tetap
tersedia untuk audit keuangan.

Integration test staging mencakup transfer langsung, FIFO, reprocess otomatis
dan manual, race condition paralel, role guard, konfirmasi delete, multi-child,
retention pembayaran, dan audit snapshot:

```bash
npm run test:phase8-integration
```

## Daftar Ulang & Join WhatsApp Phase 9

Tahap DU hanya dapat dibuka oleh wali pemilik calon murid yang sudah diterima.
Bukti JPG/PNG/PDF maksimal 5 MB disimpan sebagai object private di bucket
`bukti-pembayaran`; aksesnya selalu melalui signed URL berumur pendek. Upload
tidak meminta nominal dari wali. Admin mencatat nominal aktual saat verifikasi,
atau mengisi alasan penolakan agar wali dapat mengunggah ulang.

Pembayaran DU terverifikasi memajukan status ke `MENUNGGU_JOIN_WA`. Admin lalu
menyediakan link grup WhatsApp per peserta. Wali membuka link melalui redirect
terotorisasi dan wajib mengonfirmasi sudah bergabung; konfirmasi ini mengubah status
menjadi `SELESAI`. Tidak ada pengiriman pesan atau
integrasi WhatsApp API otomatis pada MVP. Konten kedua tahap tetap dikelola dari
CMS berdasarkan jalur/kategori:

```text
/admin/konten/admission-fee
/admin/konten/join-wa
```

Siapkan atau harden bucket Supabase sesuai kontrak proyek dengan:

```bash
npm run storage:ensure-buckets
```

Integration test staging mencakup gate tahap, ownership, signature file,
Storage private/signed URL, reject–reupload, verifikasi nominal, role admin,
multi-child, audit, dan status WhatsApp manual:

```bash
npm run test:phase9-integration
```

## Reporting Phase 10

Halaman `/admin/laporan` menyediakan pencarian nama/email dan filter jalur,
kategori, tahap keseluruhan, pembayaran pendaftaran, enrollment, assessment,
hasil pengumuman, pembayaran DU, serta status grup WhatsApp. Hasil filter yang
sama dapat diunduh melalui endpoint admin-only berikut:

```text
GET /api/admin/laporan/export?format=xlsx
GET /api/admin/laporan/export?format=csv
```

File hanya memuat rekap operasional; token Midtrans, payload mentah, path bukti
private, catatan internal, dan jawaban formulir tidak diekspor. Sel teks juga
dinetralkan dari formula injection, respons tidak di-cache, dan setiap ekspor
dicatat tanpa menyimpan kata pencarian yang mungkin memuat data pribadi.

Integration test staging memeriksa role admin, filter gabungan, status transaksi
terbaru, CSV/XLSX valid, sanitasi data, dan audit ekspor:

```bash
npm run test:phase10-integration
```

## Quality Gate Phase 11

Phase 11 menambahkan E2E Chromium untuk routing publik, anonymous guard, login
wali/admin, multi-child dashboard, role guard, dan filter laporan. Seluruh unit,
integration Phase Auth serta Phase 3–10, verifikasi migration staging, dan E2E
dapat dijalankan berurutan melalui:

```bash
npm run test:e2e:install
npm run test:phase11
```

Quality gate hanya boleh memakai Supabase staging dan Midtrans Sandbox. Matriks
coverage, perintah parsial, dan batas keamanannya tersedia di
`docs/PHASE11_TEST_MATRIX.md`.
