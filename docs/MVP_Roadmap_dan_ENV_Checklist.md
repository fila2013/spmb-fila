# Prioritas Fitur (MVP vs Fase 2) & Environment Variable Checklist
**Sistem SPMB SDIT Fitrah Insani Langkapura**
**Turunan dari:** PRD v3 & Technical Spec v1.5 (Midtrans live/production, biaya dinamis per Jalur×Kategori, auto-transfer & antrian fallback, auto-delete data calon murid)
**Tanggal:** 28 Agustus 2026

---

# Bagian A — Prioritas Fitur: MVP vs Fase 2

Prinsip pembagian: **MVP = wajib ada agar satu siklus SPMB (dari buka pendaftaran sampai join grup WA) bisa berjalan penuh tanpa proses manual di luar sistem.** Fase 2 = peningkatan yang bisa menyusul setelah sistem berjalan, tanpa mengganggu siklus SPMB yang sedang aktif.

## A.1 Ringkasan per Modul

| Modul | MVP (Fase 1) | Fase 2 |
|---|---|---|
| **Akun & Auth** | Registrasi/login email+password (Supabase Auth), reset password, satu akun banyak anak | — |
| **Jalur** | CRUD jalur, toggle aktif/nonaktif, periode tanggal, **kuota + auto-close saat penuh**, **`fallback_jalur_id`** (auto-transfer, mis. TCP→Reguler), **`hapus_data_jika_gagal`** (Reguler & Pindahan) | — |
| **Biaya Pendaftaran** | **Matrix nominal per kombinasi Jalur × Kategori**, admin CRUD, dipakai otomatis oleh Midtrans (wali murid tidak input nominal sendiri) | Diskon/kode promo per kombinasi |
| **Kategori Pendaftar** | CRUD kategori, toggle aktif, periode, kuota + auto-close; radio Alumni TKIT (2 pilihan tetap) & free-text Eksternal | — |
| **Auto-Transfer & Antrian Fallback** | TCP gagal → auto-pindah ke Reguler (cek kuota); jika kuota penuh → status antrian `menunggu_kuota_fallback` (FIFO, tanpa batas waktu), diproses ulang otomatis saat admin menambah kuota atau manual via tombol "proses ulang antrian" | Notifikasi otomatis ke wali murid saat berhasil pindah dari antrian |
| **Auto-Delete Data Calon Murid** | Reguler & Pindahan: gagal → hapus data calon murid ybs saja (cascade FK), akun & anak lain tidak tersentuh; wajib konfirmasi UI + snapshot audit log sebelum hapus | Soft-delete + anonymisasi khusus baris `pembayaran` (rekomendasi, opsional) |
| **Pembayaran Pendaftaran** | **Mode dinamis Midtrans/transfer manual** — Admin memilih mode aktif; nominal otomatis dari matrix Biaya Pendaftaran. Midtrans final via webhook, sedangkan upload manual valid maksimal 500 KB langsung verified/enrollment. | Multi payment gateway lain (jika suatu saat perlu), retry/reminder otomatis untuk transaksi pending |
| **Pembayaran DU** | Upload bukti manual + verifikasi admin | Integrasi Midtrans untuk DU (menyusul, belum diprioritaskan) |
| **Enrollment — Form** | Form Data Pribadi & Observasi dengan field **default sudah jadi** (admin bisa tambah/edit/hapus field lewat form builder sederhana: tambah, ubah label, wajib/opsional) | Drag-and-drop reorder field, tipe field lanjutan (dropdown, file upload di dalam form, conditional field) |
| **Enrollment — Validasi & Auto-fill** | Validasi No. WA format Indonesia, auto-fill Email (akun) & Asal TK (kategori) | Validasi custom lain per field (mis. regex bebas diatur admin) |
| **Assessment** | Admin input judul, tanggal per kategori, teks info | Penjadwalan slot individual per calon murid (bukan hanya tanggal massal) |
| **Announcement** | Status Diterima/Tidak/**Menunggu Kuota** per anak (manual satu-satu untuk Diterima/Tidak; status Menunggu Kuota otomatis dari sistem), teks & tanggal rilis, 1 gambar | CMS layout builder (banyak blok, urutan bebas), bulk-input via Excel |
| **Admission Fee (DU)** | Info teks + tanggal + upload bukti bayar | Reminder otomatis mendekati deadline (email/WA) |
| **Join With Us** | Info teks + status per anak (manual: menunggu/sudah diundang) | Integrasi API WhatsApp Business untuk invite otomatis |
| **Admin Dashboard** | List peserta + filter dasar (jalur, kategori, status bayar/enrollment/kelulusan), detail per peserta | Dashboard analitik (grafik pendaftar per hari, funnel drop-off) |
| **Laporan** | Export Excel/CSV rekap peserta & hasil pengumuman | Laporan terjadwal otomatis (mis. email mingguan ke yayasan) |
| **Role** | Wali Murid & Admin | Role terpisah Bendahara & Tim Asesor dengan hak akses berbeda |
| **Notifikasi** | Tidak ada — wali murid cek status manual di dashboard | Notifikasi email/WA otomatis di setiap perubahan status |
| **Audit Log** | Dicatat di database (kolom verified_by/updated_by + timestamp) | Halaman viewer audit log khusus untuk admin |
| **Multi-tenant** | Tidak ada (1 sekolah) | Multi-sekolah/multi-cabang jika dibutuhkan |

## A.2 Definisi "Selesai MVP" (Launch Checklist Fungsional)

Sistem dianggap siap dipakai untuk satu siklus SPMB penuh jika:
- [ ] Wali murid bisa daftar akun, tambah >1 anak, dan menuntaskan seluruh 10 tahap sampai status "sudah diundang" tanpa bantuan manual admin di luar sistem (kecuali proses invite WA itu sendiri yang memang tetap manual by design).
- [ ] Admin bisa mengatur seluruh jalur/kategori/kuota/periode, **matrix biaya pendaftaran**, dan konten 4 tahap terakhir tanpa perlu bantuan developer.
- [ ] Pembayaran pendaftaran mode dinamis berjalan dengan **nominal otomatis** sesuai kombinasi jalur+kategori: Midtrans verified lewat webhook atau transfer manual verified setelah upload valid maksimal 500 KB.
- [ ] Verifikasi pembayaran DU (manual) berjalan dan tercatat rapi di dashboard admin.
- [ ] **Auto-transfer TCP→Reguler teruji**: kuota Reguler tersedia → langsung diterima; kuota penuh → status "Menunggu Kuota" (bukan "Tidak Diterima"), masuk antrian FIFO, dan berhasil diproses otomatis saat admin menambah kuota.
- [ ] **Auto-delete data calon murid teruji** (jalur Reguler & Pindahan): hanya data calon murid yang gagal yang terhapus, akun wali murid & anak lain tetap utuh, ada konfirmasi UI sebelum eksekusi.
- [ ] Export Excel rekap peserta berfungsi.
- [ ] Kuota tidak pernah "kebobolan" saat diuji dengan submission bersamaan (race condition test) — termasuk saat proses ulang antrian fallback berjalan bersamaan.

## A.3 Yang Sengaja Ditunda ke Fase 2 (bukan celah, tapi keputusan sadar)

1. ~~**Midtrans**~~ — **sudah dimajukan ke MVP** (API key production sudah tersedia), lihat Bagian C untuk detail integrasi.
2. **Notifikasi otomatis** — risiko biaya (WA API berbayar) & kompleksitas integrasi, tidak menghalangi jalannya proses inti.
3. **Role Bendahara/Tim Asesor terpisah** — di MVP, Admin merangkap semua fungsi ini; cukup untuk skala satu sekolah.
4. **Bulk upload Excel untuk hasil kelulusan** — PRD sudah eksplisit: tetap manual satu-satu di v1.
5. **Midtrans untuk pembayaran DU** — tetap manual dulu; DU baru dipertimbangkan integrasi Midtrans di iterasi berikutnya setelah alur pendaftaran terbukti stabil.

---

# Bagian B — Environment Variable Checklist (Vercel + Supabase)

## B.1 Persiapan di Supabase Dashboard (sebelum isi env var)

- [ ] Buat project Supabase baru (disarankan 2 project: `spmb-staging` dan `spmb-production`).
- [ ] Aktifkan **Auth → Email provider** (email+password).
- [ ] Buat 2 bucket di **Storage**:
  - `bukti-pembayaran` → **private**
  - `konten-cms` → **public**
- [ ] Ambil connection string database (Settings → Database) — catat versi **pooled (port 6543, PgBouncer)** dan **direct (port 5432)**.
- [ ] (Opsional, direkomendasikan untuk produksi) Setup custom SMTP di Auth settings agar email reset password tidak kena rate limit bawaan Supabase.

## B.2 Daftar Environment Variable

### Supabase — Koneksi Aplikasi

| Variable | Contoh Nilai | Sumber | Public/Secret |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase → Settings → API | Public (boleh di client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Supabase → Settings → API | Public (boleh di client, dibatasi oleh RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Supabase → Settings → API | **Secret — hanya server-side, jangan pernah expose ke client** |

### Database (Prisma)

| Variable | Contoh Nilai | Sumber | Catatan |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://...:6543/postgres?pgbouncer=true` | Supabase → Settings → Database (Connection pooling) | Dipakai runtime app (serverless-friendly) |
| `DIRECT_URL` | `postgresql://...:5432/postgres` | Supabase → Settings → Database (Direct connection) | Dipakai khusus saat `prisma migrate` |

### Storage

| Variable | Contoh Nilai | Catatan |
|---|---|---|
| `SUPABASE_STORAGE_BUCKET_PEMBAYARAN` | `bukti-pembayaran` | Nama bucket privat |
| `SUPABASE_STORAGE_BUCKET_CMS` | `konten-cms` | Nama bucket publik |

### Aplikasi Umum

| Variable | Contoh Nilai | Catatan |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://spmb.fitrahinsani.sch.id` (prod) / preview URL (staging) | Dipakai untuk redirect URL reset password & link di email |
| `NODE_ENV` | `production` / `development` | Otomatis diset Vercel, tidak perlu diisi manual |
| `VERCEL_ENV` | `production` / `preview` / `development` | Otomatis diset Vercel |

### Payment Gateway — Midtrans (WAJIB, sudah live/production)

| Variable | Contoh Nilai | Sumber | Public/Secret |
|---|---|---|---|
| `MIDTRANS_SERVER_KEY` | `Mid-server-xxxxxxxxxxxxx` | Midtrans Dashboard → Settings → Access Keys (**Production**) | **Secret — hanya server-side, JANGAN pernah expose ke client/browser** |
| `MIDTRANS_CLIENT_KEY` | `Mid-client-xxxxxxxxxxxxx` | Midtrans Dashboard → Settings → Access Keys (**Production**) | Public (dipakai untuk memuat skrip Snap.js di frontend) |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | sama dengan di atas | — | Public (versi yang boleh diakses browser, prefix `NEXT_PUBLIC_` wajib agar terbaca di client) |
| `MIDTRANS_IS_PRODUCTION` | `true` | — | Menentukan Snap.js & endpoint API mengarah ke live, bukan sandbox |

> ⚠️ **Key yang kamu punya adalah production/live** — setiap transaksi yang lewat akan memotong saldo/rekening sungguhan. Simpan `MIDTRANS_SERVER_KEY` hanya di Vercel Environment Variables (server-side), jangan pernah taruh di file yang ikut ter-commit ke Git, dan jangan tempel di `.env` yang di-share lewat chat/dokumen.

### Opsional — Fase 2 (siapkan nama variabel dari sekarang agar tidak perlu refactor)

| Variable | Untuk |
|---|---|
| `WA_BUSINESS_API_TOKEN` | Notifikasi/invite WA otomatis (Fase 2) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting lanjutan di endpoint auth (Fase 2, opsional) |

## B.3 Pemetaan Environment Vercel

| Vercel Environment | Terhubung ke Supabase Project | Kapan dipakai |
|---|---|---|
| **Production** | `spmb-production` | Domain resmi, dipakai wali murid & admin sungguhan |
| **Preview** | `spmb-staging` | Setiap pull request/branch baru, untuk testing sebelum merge |
| **Development** (lokal, `.env.local`) | `spmb-staging` (atau project Supabase lokal terpisah jika tim mau isolasi lebih jauh) | Development di komputer masing-masing developer |

> Set env var di Vercel lewat **Project Settings → Environment Variables**, pisahkan nilai untuk Production vs Preview agar staging tidak pernah menyentuh data pendaftar asli.

## B.4 Checklist Setup Awal (urutan disarankan)

- [ ] 1. Buat 2 project Supabase (staging & production).
- [ ] 2. Jalankan migration Prisma pertama kali ke **staging** dulu (`DIRECT_URL` staging).
- [ ] 3. Isi semua env var di atas ke Vercel untuk environment **Preview** (staging).
- [ ] 4. Deploy branch awal ke Preview, uji seluruh alur end-to-end (register → join WA) di staging.
- [ ] 5. Setelah lolos uji, ulangi migration ke project **production**.
- [ ] 6. Isi env var yang sama untuk environment **Production** di Vercel (nilai berbeda, mengarah ke project Supabase production).
- [ ] 7. Hubungkan domain resmi sekolah ke deployment Production di Vercel.
- [ ] 8. Uji ulang sekali lagi di Production dengan data dummy sebelum SPMB resmi dibuka ke publik.

---

# Bagian C — Setup Midtrans Dashboard (Live/Production)

Karena key yang kamu punya sudah production, langkah setup ini dilakukan di **akun Midtrans production**, bukan sandbox.

## C.1 Checklist Setup

- [ ] 1. Login ke **Midtrans Dashboard** (production, bukan `sandbox.midtrans.com`).
- [ ] 2. Ambil **Server Key** & **Client Key** dari Settings → Access Keys, masukkan ke Vercel Environment Variables (Production environment saja — jangan pasang production key di environment Preview/staging).
- [ ] 3. Buka **Settings → Configuration**, isi **Payment Notification URL** dengan:
      `https://spmb.fitrahinsani.sch.id/api/webhooks/midtrans`
      (ganti dengan domain resmi yang sudah live di Vercel)
- [ ] 4. (Opsional) isi juga **Finish/Unfinish/Error Redirect URL** jika ingin Snap mengarahkan wali murid kembali ke halaman tertentu setelah popup selesai — arahkan ke `/anak/:id/pembayaran-pendaftaran` agar wali murid melihat status terbaru.
- [ ] 5. Aktifkan metode pembayaran yang diinginkan (VA BCA/BNI/Mandiri, QRIS, GoPay, dll.) di Settings → Payment Methods sesuai kebutuhan sekolah.
- [ ] 6. **Isi matrix Biaya Pendaftaran** (`/admin/biaya-pendaftaran`) untuk setiap kombinasi Jalur × Kategori yang aktif — pastikan tidak ada kombinasi berstatus "Kosong", karena wali murid akan diblokir di halaman bayar sampai admin mengisinya (lihat wireframe layar A4b).
- [ ] 7. **Uji satu transaksi nominal kecil** dengan akun sungguhan (karena ini live) untuk memastikan: nominal terisi otomatis sesuai matrix → Snap popup muncul → pembayaran berhasil → webhook diterima → status `pembayaran` di database berubah jadi `verified` → status `calon_murid` otomatis lanjut ke tahap Enrollment.
- [ ] 8. Cek log notifikasi di Midtrans Dashboard (**Transactions**) untuk memastikan webhook benar-benar terkirim & direspons `200 OK` oleh server — jika Midtrans tidak menerima `200`, ia akan retry beberapa kali.
- [ ] 9. **Uji skenario auto-transfer & antrian fallback** di staging sebelum live: tandai satu calon murid TCP "Tidak Diterima" saat kuota Reguler masih ada (harus langsung pindah & diterima), lalu ulangi saat kuota Reguler sengaja dipenuhkan (harus masuk status "Menunggu Kuota", bukan "Tidak Diterima") — lalu tambah kuota dan pastikan antrian otomatis diproses.
- [ ] 10. **Uji skenario auto-delete** di staging: tandai calon murid jalur Reguler/Pindahan "Tidak Diterima", pastikan hanya data calon murid tsb yang hilang, akun & anak lain tetap ada.
- [ ] 11. Setelah semua uji coba sukses, informasikan ke bendahara/admin bahwa sistem sudah bisa dipakai untuk transaksi sungguhan dari wali murid.

## C.2 Hal yang Perlu Diperhatikan Selama Berjalan

- Pantau **Transactions log** di Midtrans Dashboard secara berkala di awal peluncuran, bandingkan dengan data `pembayaran` di Supabase — pastikan tidak ada transaksi yang "menggantung" (sukses di Midtrans tapi status di sistem masih `pending`, biasanya karena webhook gagal/timeout).
- Siapkan mekanisme manual di Admin Dashboard untuk **override status pembayaran** (admin bisa tandai verified manual) sebagai jaring pengaman kalau webhook bermasalah — meski jenisnya Midtrans.
- Rekonsiliasi nominal: sesekali cocokkan total dana yang masuk ke rekening/merchant Midtrans dengan total `gross_amount` yang tercatat `verified` di database.

---

*Dokumen ini melengkapi PRD v3 dan Technical Spec v1.5, digunakan sebagai acuan perencanaan sprint & setup infrastruktur awal oleh tim development.*
