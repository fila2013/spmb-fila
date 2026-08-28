# AGENTS.md — SPMB Fila

## 1. Project Identity

Project ini adalah **SPMB Fila**, aplikasi Sistem Penerimaan Murid Baru untuk SDIT Fitrah Insani Langkapura.

Source of truth utama:
- `docs/SPMB-FILA-SPEC.md`
- PRD/technical documents lain di `docs/` bila tersedia.

Baca dokumen yang relevan sebelum mengubah kode.

---

## 2. Tech Stack

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- Next.js Route Handlers
- Prisma ORM
- PostgreSQL via Supabase
- Supabase Auth
- Supabase Storage
- Vercel
- Midtrans Snap untuk pembayaran pendaftaran

---

## 3. Core Architecture

```text
Browser
  ↓
Next.js
  ↓
Route Handler / Server Logic
  ↓
Prisma
  ↓
Supabase PostgreSQL
```

Supabase juga digunakan untuk:
- Auth
- Storage

Midtrans dipanggil dari server.

**Business-critical logic wajib server-side.**

---

## 4. Non-Negotiable Rules

### Authentication

Gunakan **Supabase Auth**.

Jangan:
- membuat authentication manual;
- menyimpan password plaintext;
- membuat password hashing sendiri untuk menggantikan Supabase Auth.

Tabel aplikasi `users` menyimpan profile dan role.

### Authorization

Selalu validasi:
1. session;
2. role;
3. ownership data.

Jangan percaya `user_id` yang dikirim client.

### Secrets

`SUPABASE_SERVICE_ROLE_KEY` dan `MIDTRANS_SERVER_KEY`:
- hanya server-side;
- tidak boleh `NEXT_PUBLIC_`;
- tidak boleh di-log;
- tidak boleh di-commit;
- jangan pernah ditulis di source code.

### Database

Prisma adalah ORM utama.

Gunakan migration yang aman.

Jangan melakukan perubahan schema destruktif tanpa menjelaskan dampaknya.

---

## 5. Critical Business Rules

### Payment

Nominal pembayaran pendaftaran:

```text
Jalur × Kategori → biaya_pendaftaran.nominal
```

**User tidak pernah mengisi nominal.**

Backend harus mengambil nominal dari database.

Jika biaya belum diatur:
- jangan membuat transaksi;
- jangan mengarahkan user ke Midtrans.

### Midtrans

- Pembayaran pendaftaran menggunakan Midtrans Snap production.
- Pembayaran DU tetap manual pada MVP.
- Snap token dibuat server-side.
- `MIDTRANS_SERVER_KEY` hanya server-side.
- Status final pembayaran berasal dari webhook.
- Webhook wajib memverifikasi signature.
- Webhook harus idempotent.
- `midtrans_order_id` unique.

Webhook endpoint:

```text
POST /api/webhooks/midtrans
```

Webhook tidak membutuhkan session login.

### Quota

Kuota adalah critical section.

Semua operasi berikut harus atomik:
- pendaftaran jalur;
- pendaftaran kategori;
- auto-transfer;
- proses ulang FIFO.

Gunakan database transaction + row locking/strategi atomic yang setara.

Frontend quota check bukan security boundary.

### TCP → Reguler

Jika TCP gagal:

```text
Reguler tersedia
  → pindah otomatis
  → langsung diterima
  → tidak perlu assessment ulang
```

Jika Reguler penuh:

```text
status = menunggu_kuota_fallback
```

Masuk FIFO.

Tidak boleh langsung dianggap `tidak_diterima`.

### Auto-delete

Reguler/Pindahan dapat memiliki:

```text
hapus_data_jika_gagal = true
```

Saat gagal:
- wajib konfirmasi admin;
- wajib audit snapshot sebelum delete;
- hanya calon murid yang gagal yang dihapus;
- akun wali murid tetap;
- anak lain tetap.

Perhatikan retention data pembayaran agar jejak keuangan tetap dapat diaudit.

---

## 6. Status Gate

Backend wajib mencegah user melompati tahap.

Contoh:

```text
payment != verified
→ enrollment forbidden
```

Jangan hanya mengandalkan redirect atau hidden UI.

---

## 7. Coding Rules

- TypeScript strict.
- Hindari `any` kecuali benar-benar diperlukan.
- Reuse domain logic.
- Jangan menaruh business rule kompleks langsung di komponen UI.
- Validasi input di server.
- Gunakan schema validation yang konsisten.
- Error response harus konsisten.
- Jangan expose internal error detail ke user.
- Jangan log secret atau data pribadi yang tidak perlu.

---

## 8. Testing Rules

Business-critical code harus memiliki test.

Minimal test untuk:
- auth authorization;
- ownership;
- quota race condition;
- biaya matrix;
- Midtrans webhook signature;
- Midtrans idempotency;
- payment state transition;
- enrollment gate;
- TCP → Reguler;
- FIFO fallback;
- reprocess queue;
- auto-delete;
- multi-child account.

Sebelum menyatakan task selesai, jalankan test/lint/typecheck yang relevan.

---

## 9. Development Workflow

Kerjakan secara incremental:

```text
Understand
  ↓
Plan
  ↓
Implement
  ↓
Test
  ↓
Review diff
  ↓
Report
```

Jangan mengimplementasikan seluruh aplikasi sekaligus.

Untuk task besar:
1. pecah menjadi task kecil;
2. selesaikan satu layer;
3. test;
4. baru lanjut.

---

## 10. Dokumen & Scope

Jangan membuat fitur Phase 2 sebelum MVP selesai.

Phase 2 antara lain:
- notifikasi otomatis;
- WhatsApp API;
- role Bendahara/Asesor;
- Midtrans DU;
- analytics;
- bulk import;
- multi-tenant;
- promo;
- advanced form builder.

Jika requirement tidak jelas:
1. cari di `docs/`;
2. cek business rules;
3. jangan menebak untuk hal yang berdampak pada database, pembayaran, kuota, authorization, atau delete;
4. minta keputusan manusia bila diperlukan.

---

## 11. Git Discipline

- Satu perubahan logis per commit bila memungkinkan.
- Commit message jelas.
- Jangan commit `.env.local`.
- Jangan commit credential.
- Jangan force-push tanpa instruksi.
- Jangan menghapus migration existing sembarangan.
- Review `git diff` sebelum menyelesaikan task.

---

## 12. Definition of Done

Task selesai hanya jika:
- implementasi sesuai spec;
- authorization benar;
- tidak ada secret exposure;
- lint/typecheck/test relevan lulus;
- migration aman bila ada perubahan database;
- tidak merusak business rules existing;
- perubahan dijelaskan secara ringkas.

---

## 13. Important

**Jangan mengarang business rule.**

Jika ada konflik antara implementasi lama dan `docs/SPMB-FILA-SPEC.md`, jangan langsung memilih implementasi lama.

Identifikasi konflik dan gunakan keputusan final dalam specification.

Khusus pembayaran, kuota, auto-transfer, auto-delete, authorization, dan migration production: prioritaskan correctness daripada kecepatan.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
