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

Phase 0 menyediakan fondasi Next.js, TypeScript strict, Tailwind CSS, Prisma ORM,
kontrak environment, Supabase client, unit test dasar, dan layout awal SPMB.

Model bisnis dan migration belum dibuat. Pekerjaan tersebut dimulai setelah
keputusan retention data pembayaran disahkan.

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

Schema awal berada di `prisma/schema.prisma`. Belum ada model domain pada Phase 0.

```bash
npm run prisma:format
npm run prisma:validate
```

Migration pertama hanya boleh dibuat setelah desain retention pembayaran dan
schema bisnis mendapat keputusan final.

## Supabase Auth

Project menggunakan `@supabase/ssr` karena session Next.js disimpan dalam
cookie. Paket `@supabase/server` tidak diperlukan pada tahap ini karena paket
tersebut ditujukan untuk backend stateless yang menerima Bearer token melalui
header. Helper tersedia di `lib/supabase`, sedangkan `proxy.ts` memverifikasi dan
memperbarui token dengan `auth.getClaims()`.
