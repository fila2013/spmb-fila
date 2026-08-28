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

Phase 0, Phase 1, dan Phase 2 sudah selesai. Selain fondasi database, project
memiliki Supabase Auth berbasis cookie, registrasi/login/logout/reset password,
sinkronisasi profile `users`, serta guard server untuk session, role, dan
ownership. Seluruh migration telah diterapkan ke database Supabase staging.

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
