# SPMB FILA — Implementation Specification

**Project:** Sistem SPMB SDIT Fitrah Insani Langkapura  
**Dokumen:** Implementation Specification  
**Versi:** 1.0  
**Tanggal:** 28 Agustus 2026  
**Status:** Baseline implementasi untuk Codex Desktop  
**Sumber utama:** PRD v3, Technical Spec v1.5, MVP Roadmap & Environment Checklist

---

## 0. Cara Membaca Dokumen Ini

Dokumen ini adalah baseline implementasi untuk repository `spmb-fila`.

Prioritas keputusan:

1. Business requirement dan keputusan final terbaru.
2. Technical Spec v1.5.
3. MVP Roadmap & Environment Checklist.
4. PRD v3 sebagai sumber requirement awal.
5. Wireframe sebagai referensi UI.

Jika ada konflik antar dokumen lama dan keputusan terbaru, gunakan keputusan yang dinyatakan di bagian **Final Decisions** dokumen ini.

### Final Decisions

Beberapa dokumen sumber berasal dari tahap desain yang berbeda. Untuk implementasi saat ini:

- **Pembayaran pendaftaran memiliki mode dinamis `MIDTRANS` atau `MANUAL`** yang dipilih Admin dari dashboard dan disimpan di database. Integrasi Midtrans tetap dipertahankan. Pada mode manual, nominal tetap berasal dari matrix Jalur × Kategori; setelah bukti JPG/PNG/PDF maksimal 500 KB berhasil disimpan, pembayaran langsung `verified` dan peserta masuk `enrollment` tanpa verifikasi Admin.
- **Rekening sekolah dikelola Admin** dan minimal satu rekening wajib tersedia sebelum mode manual dapat diaktifkan.
- **Pembayaran DU = manual**, upload bukti + verifikasi admin.
- **File bukti pembayaran pendaftaran manual dan DU dapat dihapus Admin setelah pemeriksaan selesai.** Penghapusan hanya menghapus object Storage dan mengosongkan `file_bukti_url`; record transaksi, jenis, metode, nominal, status, timestamp, dan audit tetap dipertahankan.
- **Konfirmasi email wajib aktif di Supabase Auth.** Jika signup menghasilkan session langsung, aplikasi memperlakukannya sebagai salah konfigurasi dan tidak mengaktifkan akun tersebut.
- **Beranda memiliki CMS informasi publik.** Admin dapat menambah, melihat, mengubah, mengurutkan, mengaktifkan/nonaktifkan, mengunggah gambar, dan menghapus blok informasi beranda. Perubahan penting dicatat pada audit log.
- **Konten beranda dapat memuat video YouTube.** Admin memasukkan link YouTube, aplikasi hanya menyimpan video ID tervalidasi, dan video ditampilkan di bawah judul dengan autoplay mute yang kompatibel dengan kebijakan browser.
- **Konten Assessment dan Announcement bertanggal menyediakan pengingat Google Calendar.** Event all-day dibentuk otomatis dari tahap, nama anak, judul, tanggal, dan catatan admin; wali tetap menekan tombol untuk menambahkan event ke kalender miliknya.
- **Penyelesaian Join WA = konfirmasi wali**. Setelah DU terverifikasi, admin menyediakan link grup per peserta. Wali membuka link melalui tombol aplikasi lalu wajib mengonfirmasi sudah bergabung; hanya konfirmasi wali yang mengubah pendaftaran menjadi `selesai`.
- **Supabase Auth** adalah mekanisme authentication. Jangan membuat password hashing/authentication sendiri di tabel `users`.
- **Prisma** adalah ORM utama untuk akses PostgreSQL.
- **Supabase** digunakan untuk PostgreSQL, Auth, dan Storage.
- Akses database/storage sensitif dilakukan server-side.
- `MIDTRANS_SERVER_KEY` hanya server-side.
- Nominal pembayaran pendaftaran berasal dari matrix `Jalur × Kategori`; wali murid tidak pernah mengisi nominal.
- Auto-transfer TCP → Reguler dan fallback FIFO adalah business rule inti.
- Auto-delete hanya menghapus data calon murid yang gagal, bukan akun wali murid atau anak lain.
- Jejak keuangan pembayaran tetap disimpan ketika calon murid dihapus. Relasi aktif `calon_murid_id` menggunakan `ON DELETE SET NULL`, sedangkan UUID referensi non-PII, nominal, metode, status, referensi Midtrans, payload audit yang sudah disanitasi, dan timestamp dipertahankan untuk audit keuangan.
- MVP hanya memiliki dua role: Wali Murid dan Admin.
- Multi-tenant, role Bendahara/Asesor terpisah, notifikasi otomatis, dan WhatsApp API otomatis ditunda ke Phase 2.

---

# 1. Project Overview

## 1.1 Latar Belakang

SPMB SDIT Fitrah Insani Langkapura saat ini menjalankan proses secara manual/tersebar melalui form, WhatsApp, dan spreadsheet.

SPMB Fila mendigitalkan alur:

1. Registrasi akun.
2. Login.
3. Menambahkan satu atau lebih calon murid.
4. Memilih jalur.
5. Memilih kategori.
6. Pembayaran pendaftaran.
7. Enrollment.
8. Assessment.
9. Announcement.
10. Admission Fee / DU.
11. Join With Us / grup WhatsApp.

Sistem harus memungkinkan admin mengelola jalur, kategori, kuota, biaya, form enrollment, konten tahap, pembayaran, hasil assessment, pengumuman, DU, dan status grup tanpa perubahan kode untuk setiap tahun ajaran.

## 1.2 Tujuan

- Wali murid dapat mengelola lebih dari satu anak dalam satu akun.
- Admin dapat mengelola seluruh proses dari dashboard.
- Mengurangi input berulang melalui auto-fill.
- Menjamin kuota tidak melebihi batas saat terjadi submission bersamaan.
- Menyediakan pembayaran pendaftaran otomatis melalui Midtrans.
- Menyediakan pembayaran DU secara manual.
- Menyediakan audit terhadap perubahan penting.
- Menyediakan export laporan Excel/CSV.

---

# 2. Scope MVP

## 2.1 MVP

### Akun & Auth
- Registrasi email + password.
- Login/logout.
- Reset password.
- Satu akun dapat memiliki banyak anak.
- Role Wali Murid dan Admin.

### Jalur
- TCP.
- Reguler.
- Pindahan.
- Aktif/nonaktif.
- Periode.
- Kuota.
- Auto-close saat kuota penuh.
- `fallback_jalur_id`.
- `hapus_data_jika_gagal`.

### Kategori
- Alumni TKIT.
- Eksternal/Umum.
- Aktif/nonaktif.
- Periode.
- Kuota.
- Alumni memiliki dua pilihan tetap:
  - TKIT Fitrah Insani 1.
  - TKIT Fitrah Insani 2.
- Eksternal mengisi asal TK.

### Biaya Pendaftaran
- Matrix Jalur × Kategori.
- Admin mengatur nominal.
- Nominal otomatis digunakan saat membuat transaksi Midtrans.
- User tidak dapat mengubah nominal.
- Kombinasi tanpa biaya aktif harus diblokir.

### Pembayaran Pendaftaran
- Mode aktif dipilih Admin: Midtrans Snap atau transfer bank manual.
- Mode Midtrans menggunakan alur Snap dan webhook yang sudah ada.
- Mode manual menampilkan rekening sekolah dan upload bukti maksimal 500 KB.
- Upload manual yang berhasil langsung menghasilkan status pembayaran `verified` dan membuka enrollment.
- Admin dapat melihat dan mengunduh bukti transfer manual pada detail peserta.
- Setelah pemeriksaan selesai, Admin dapat menghapus file bukti tanpa menghapus record transaksi.
- VA / QRIS / e-wallet sesuai metode yang diaktifkan merchant.
- Snap token dibuat server-side.
- Status final ditentukan webhook.
- Webhook idempotent.

### Pembayaran DU
- Upload bukti manual.
- Verifikasi/reject admin.
- Tidak menggunakan Midtrans pada MVP.

### Enrollment
- Form Data Pribadi.
- Form Observasi.
- Admin dapat mengatur field dasar.
- Draft.
- Submit final.
- Validasi No. WA.
- Auto-fill Email.
- Auto-fill Asal TK.

### Assessment
- Konten admin.
- Tanggal/periode per kategori.
- Status hasil assessment per calon murid.

### Announcement
- Admin memasukkan hasil satu per satu.
- Status Diterima/Tidak Diterima.
- Status Menunggu Kuota untuk fallback.
- Tanggal rilis.
- Konten announcement.

### Auto-transfer
- TCP gagal → Reguler jika fallback tersedia.
- Jika Reguler punya kuota → langsung diterima.
- Jika Reguler penuh → masuk `menunggu_kuota_fallback`.
- FIFO.
- Reprocess otomatis saat kuota bertambah.
- Reprocess manual tersedia.

### Auto-delete
- Reguler dan Pindahan dapat menghapus data calon murid ketika gagal.
- Wajib konfirmasi UI.
- Wajib audit snapshot sebelum delete.
- Akun wali murid tidak dihapus.
- Anak lain tidak dihapus.

### Join With Us
- Konten admin.
- Status `menunggu` / `sudah_diundang`.
- Admin mengubah status manual.

### Reporting
- Filter peserta.
- Export Excel/CSV.

## 2.2 Phase 2

- Notifikasi email/WhatsApp otomatis.
- Role Bendahara.
- Role Tim Asesor.
- WhatsApp Business API.
- Midtrans untuk DU.
- Diskon/kode promo.
- Slot assessment individual.
- Form builder lanjutan.
- Dashboard analytics.
- Bulk upload hasil.
- Multi-school/multi-tenant.
- Audit log viewer khusus.
- Retry/reminder otomatis.

---

# 3. User & Role

## 3.1 Wali Murid

Dapat:
- Register.
- Login.
- Reset password.
- Melihat dashboard Anak Saya.
- Menambah anak.
- Memilih jalur dan kategori.
- Membayar pendaftaran.
- Mengisi enrollment.
- Melihat assessment.
- Melihat announcement.
- Mengunggah bukti DU.
- Melihat status DU.
- Melihat status grup WA.

Tidak dapat:
- Melihat data anak milik akun lain.
- Mengubah nominal pembayaran.
- Mengubah kuota.
- Mengubah status kelulusan.
- Mengakses admin.

## 3.2 Admin

Dapat:
- Login admin.
- Mengelola jalur.
- Mengelola kategori.
- Mengelola kuota.
- Mengelola biaya.
- Mengelola form.
- Mengelola konten.
- Melihat peserta.
- Verifikasi pembayaran.
- Mengisi assessment.
- Mengisi pengumuman.
- Memproses antrian fallback.
- Mengelola status DU.
- Mengelola status grup WA.
- Export laporan.

---

# 4. End-to-End User Flow

```text
Register
  ↓
Login
  ↓
Dashboard "Anak Saya"
  ↓
Tambah Anak
  ↓
Pilih Jalur
  ↓
Pilih Kategori
  ↓
Biaya Pendaftaran Otomatis
  ↓
Bayar via Midtrans
  ↓
Webhook → pembayaran verified
  ↓
Enrollment
  ├── Data Pribadi
  └── Observasi
  ↓
Assessment
  ↓
Announcement
  ├── Diterima
  │     ↓
  │   Admission Fee / DU
  │     ↓
  │   Upload Bukti DU
  │     ↓
  │   Verifikasi Admin
  │     ↓
  │   Join With Us
  │
  ├── Tidak Diterima
  │     └── mengikuti aturan fallback/delete
  │
  └── Menunggu Kuota
        └── menunggu proses fallback FIFO
```

---

# 5. Business Rules

## 5.1 Jalur

Jalur:
- TCP.
- Reguler.
- Pindahan.

Setiap jalur memiliki:
- status aktif.
- periode buka/tutup.
- kuota maksimum.
- kuota terpakai.
- fallback optional.
- flag auto-delete saat gagal.

Jika kuota tercapai, jalur tidak boleh dipilih calon murid baru.

Admin tetap dapat melakukan override sesuai kebutuhan operasional.

## 5.2 Kategori

Kategori aktif ditentukan admin.

Untuk Alumni:
- TKIT Fitrah Insani 1.
- TKIT Fitrah Insani 2.

Dua pilihan tersebut adalah pilihan tetap dan bukan CRUD biasa.

Untuk Eksternal:
- User mengisi nama TK asal.

Asal TK kemudian menjadi sumber auto-fill enrollment.

## 5.3 Kuota

Semua perubahan kuota yang memengaruhi pendaftaran harus dilakukan secara atomik.

Tidak boleh:

```text
SELECT kuota
INSERT peserta
UPDATE kuota
```

tanpa transaction/locking.

Wajib:

```text
BEGIN
  lock row
  cek kuota
  insert peserta
  increment kuota
COMMIT
```

Pola yang sama berlaku untuk:
- Jalur.
- Kategori.
- Auto-transfer fallback.
- Reprocessing FIFO.

## 5.4 Matrix Biaya

Admin mengisi:

```text
Jalur × Kategori → Nominal
```

Contoh:

```text
TCP + Alumni = Rp450.000
TCP + Eksternal = Rp500.000
Reguler + Alumni = Rp400.000
Reguler + Eksternal = Rp450.000
```

Nominal hanya berasal dari server/database.

Frontend tidak boleh mengirim nominal sebagai sumber kebenaran.

Jika kombinasi aktif tidak memiliki biaya aktif:
- Jangan membuat transaksi.
- Jangan arahkan ke Midtrans.
- Tampilkan pesan bahwa biaya belum diatur admin.

## 5.5 Pembayaran Pendaftaran

Alur:

```text
Klik Bayar
 ↓
Backend autentikasi user
 ↓
Backend validasi calon murid
 ↓
Backend lookup Jalur + Kategori
 ↓
Backend lookup biaya
 ↓
Backend membuat order_id
 ↓
Backend membuat Snap transaction
 ↓
Simpan pending + snap_token
 ↓
Frontend membuka Snap
 ↓
Midtrans mengirim webhook
 ↓
Verifikasi signature
 ↓
Update pembayaran
 ↓
Jika settlement/capture → verified
 ↓
Calon murid masuk enrollment
```

Redirect browser bukan sumber status final.

Webhook adalah sumber kebenaran status pembayaran.

## 5.6 Idempotency Midtrans

`midtrans_order_id` harus unique.

Webhook duplikat tidak boleh:
- membuat pembayaran kedua.
- menambah kuota dua kali.
- memajukan status berkali-kali secara salah.

Webhook harus aman dipanggil berulang.

## 5.7 Auto-transfer TCP → Reguler

Jika TCP memiliki `fallback_jalur_id = Reguler`:

```text
TCP Tidak Diterima
       ↓
Cek kuota Reguler
       ↓
 ┌─────┴─────┐
 ADA         PENUH
 ↓             ↓
Pindah       Menunggu
 ↓             ↓
Diterima      FIFO
```

Jika kuota tersedia:
- `jalur_id` → Reguler.
- `jalur_asal_id` → TCP.
- Kuota Reguler bertambah.
- Status → `diterima`.
- Lanjut Admission Fee.
- Tidak perlu assessment ulang.
- Tidak perlu bayar ulang.
- Catat audit.

Jika penuh:
- Status → `menunggu_kuota_fallback`.
- `menunggu_fallback_jalur_id` → Reguler.
- Announcement belum final.
- Masuk FIFO berdasarkan `created_at`.
- Wali murid melihat status Menunggu.

## 5.8 Reprocess FIFO

Saat kuota Reguler bertambah:
1. Ambil kandidat menunggu berdasarkan `created_at ASC`.
2. Lock kuota Reguler.
3. Pindahkan kandidat pertama.
4. Jika kuota habis, hentikan proses.
5. Kandidat lain tetap menunggu.

Sediakan:
- `GET /api/admin/jalur/:id/antrian-fallback`
- `POST /api/admin/jalur/:id/proses-ulang-antrian`

## 5.9 Auto-delete

Untuk jalur dengan `hapus_data_jika_gagal = true`:

1. Admin menandai Tidak Diterima.
2. Sistem menentukan apakah ada fallback.
3. Jika tidak ada transfer yang berhasil dan flag delete aktif:
   - tampilkan konfirmasi.
   - simpan snapshot audit.
   - hapus calon murid.
4. Akun wali murid tetap.
5. Anak lain tetap.
6. Data terkait calon murid mengikuti kebijakan retention/audit.

**Catatan implementasi:** karena pembayaran adalah data keuangan, jangan membuat keputusan hard-delete pembayaran secara sembarangan. Gunakan desain retention yang menjaga jejak transaksi tanpa mempertahankan data pribadi yang tidak diperlukan.

## 5.10 Enrollment Gate

Enrollment hanya boleh diakses jika pembayaran pendaftaran:

```text
verified
```

Backend wajib memvalidasi gate ini, bukan hanya frontend.

## 5.11 Announcement

Admin mengisi hasil per anak.

Status:
- `diterima`
- `tidak_diterima`

Fallback:
- `menunggu_kuota_fallback`

Tanggal rilis harus dihormati. Sebelum tanggal rilis, user tidak boleh melihat hasil final.

## 5.12 Admission Fee / DU

Hanya calon murid `diterima` yang dapat melihat tahap DU.

DU:
- Info kebijakan.
- Nominal/persentase.
- Periode.
- Upload bukti.
- Admin verifikasi.

## 5.13 Join WA

Admin menyediakan link grup setelah pembayaran DU terverifikasi.

Wali murid:
- membuka link melalui tombol aplikasi; URL mentah tidak ditampilkan pada UI wali;
- kembali ke halaman Join WA;
- mengonfirmasi **Iya, saya sudah masuk**.

Status `selesai` hanya ditetapkan setelah konfirmasi wali. Sistem mencatat waktu link ditetapkan, pertama dibuka, dan dikonfirmasi.

Sistem tidak membuat grup WhatsApp otomatis pada MVP.

---

# 6. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Routing | Next.js App Router |
| Styling | Tailwind CSS |
| Backend | Next.js Route Handlers |
| ORM | Prisma |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Payment | Midtrans Snap |
| Hosting | Vercel |
| Reporting | Excel/CSV |
| Repository | GitHub |

Arsitektur:

```text
Browser
   ↓ HTTPS
Next.js / Vercel
   ├── UI
   ├── Server Components
   ├── Route Handlers
   ├── Business Logic
   └── Prisma
          ↓
   Supabase PostgreSQL

Supabase:
   ├── Auth
   ├── PostgreSQL
   └── Storage

Next.js Server
   ↓
Midtrans API

Midtrans
   ↓ webhook
/api/webhooks/midtrans
```

---

# 7. Aturan Arsitektur

## 7.1 Server-side First

Business-critical logic wajib server-side:
- authorization.
- quota.
- biaya.
- payment creation.
- payment verification.
- status transition.
- auto-transfer.
- auto-delete.
- admin operations.

Frontend hanya UI dan interaction layer.

## 7.2 Prisma

Prisma adalah ORM utama untuk database.

Jangan membuat sebagian besar query menggunakan Prisma lalu sebagian lain menggunakan Supabase table API tanpa alasan yang jelas.

Supabase client digunakan terutama untuk:
- Auth.
- Storage.
- kebutuhan Supabase-specific.

## 7.3 Supabase Service Role

Service role key:
- hanya server-side.
- tidak pernah `NEXT_PUBLIC_`.
- tidak pernah masuk Git.
- tidak pernah di-log.

## 7.4 Authentication

Gunakan Supabase Auth.

Jangan:
- membuat password hash sendiri.
- menyimpan password plaintext.
- membuat session system sendiri jika tidak diperlukan.

Tabel aplikasi `users` menyimpan profile/role dan referensi ke identity Supabase.

## 7.5 Authorization

Setiap endpoint harus memeriksa:
1. session valid.
2. user aktif.
3. role jika endpoint admin.
4. ownership untuk data calon murid.

Jangan percaya `user_id` yang dikirim browser.

---

# 8. Database Baseline

Entitas utama:

```text
users
jalur
kategori_pendaftar
biaya_pendaftaran
calon_murid
form_field
form_response
pembayaran
konten_tahap
hasil_assessment
pengumuman
status_grup_wa
audit_log
```

## 8.1 users

Konsep:

```text
id
supabase_auth_user_id
email
role
status_aktif
created_at
updated_at
```

Role:

```text
wali_murid
admin
```

Password dikelola Supabase Auth, bukan tabel ini.

## 8.2 jalur

```text
id
nama
status_aktif
periode_mulai
periode_selesai
kuota_maks
kuota_terpakai
fallback_jalur_id
hapus_data_jika_gagal
created_at
updated_at
```

## 8.3 kategori_pendaftar

```text
id
nama
tipe
status_aktif
periode_mulai
periode_selesai
kuota_maks
kuota_terpakai
created_at
updated_at
```

## 8.4 biaya_pendaftaran

```text
id
jalur_id
kategori_id
nominal
status_aktif
created_at
updated_at
```

Constraint:

```text
UNIQUE(jalur_id, kategori_id)
```

## 8.5 calon_murid

```text
id
user_id
nama_anak
jalur_id
kategori_id
sub_kategori_enum
sub_kategori_text
jalur_asal_id
menunggu_fallback_jalur_id
status_keseluruhan
created_at
updated_at
```

Status utama:

```text
pilih_jalur
menunggu_verifikasi_bayar
enrollment
menunggu_asesmen
menunggu_pengumuman
diterima
tidak_diterima
menunggu_kuota_fallback
menunggu_du
menunggu_join_wa
selesai
```

## 8.6 form_field

```text
id
form_type
label
tipe_input
wajib
urutan
validasi
auto_fill_source
created_at
```

## 8.7 form_response

```text
id
calon_murid_id
field_id
value
updated_at
```

Unique:

```text
UNIQUE(calon_murid_id, field_id)
```

## 8.8 pembayaran

```text
id
calon_murid_id (nullable setelah calon murid dihapus)
calon_murid_reference (UUID non-PII yang tetap disimpan)
jenis
metode_pembayaran
nominal
file_bukti_url
status
catatan_admin
verified_by
verified_at

midtrans_order_id
midtrans_transaction_id
midtrans_snap_token
midtrans_payment_type
midtrans_raw_payload

created_at
updated_at
```

Jenis:

```text
pendaftaran
du
```

Metode:

```text
manual_transfer
midtrans
```

Status:

```text
pending
verified
rejected
```

## 8.9 konten_tahap

```text
id
tahap
judul
tanggal
isi_teks
gambar_url
urutan_layout
status_aktif
jalur_id (opsional)
kategori_id (opsional)
created_at
updated_at
```

Tahap:

```text
assessment
announcement
admission_fee
join_wa
```

## 8.10 hasil_assessment

```text
calon_murid_id
status
catatan
updated_at
```

## 8.11 pengumuman

```text
calon_murid_id
status_akhir
tanggal_rilis
updated_by
updated_at
```

## 8.12 status_grup_wa

```text
calon_murid_id
status
link_undangan
link_ditetapkan_at
link_dibuka_at
dikonfirmasi_wali_at
updated_by
updated_at
```

## 8.13 audit_log

Disarankan:

```text
id
actor_id
action
entity
entity_id
detail JSONB
created_at
```

Audit minimal untuk:
- verifikasi pembayaran.
- reject pembayaran.
- perubahan kuota.
- perubahan jalur.
- perubahan kategori.
- hasil assessment.
- hasil announcement.
- auto-transfer.
- auto-delete.
- proses ulang antrian.

---

# 9. Storage

Bucket:

```text
bukti-pembayaran
```

Private.

Untuk:
- bukti pembayaran DU.
- fallback manual jika fitur manual dipertahankan.

Bucket:

```text
konten-cms
```

Public.

Untuk:
- gambar assessment.
- announcement.
- admission fee.
- join WA.

File bukti pembayaran:
- maksimal 5 MB.
- jpg.
- png.
- pdf.

Akses file private harus menggunakan signed URL.

---

# 10. Routing

## 10.1 Public / Wali Murid

```text
/register
/login
/forgot-password
/dashboard
/anak/tambah
/anak/:id/kategori
/anak/:id/pembayaran-pendaftaran
/anak/:id/enrollment/data-pribadi
/anak/:id/enrollment/observasi
/anak/:id/assessment
/anak/:id/pengumuman
/anak/:id/admission-fee
/anak/:id/join-wa
```

## 10.2 Admin

```text
/admin/login
/admin/dashboard
/admin/peserta/:id
/admin/jalur
/admin/kategori
/admin/biaya-pendaftaran
/admin/form-builder
/admin/konten/assessment
/admin/konten/announcement
/admin/konten/admission-fee
/admin/konten/join-wa
/admin/laporan
```

## 10.3 API

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Calon Murid

```text
GET   /api/calon-murid
POST  /api/calon-murid
GET   /api/calon-murid/:id
PATCH /api/calon-murid/:id/jalur
PATCH /api/calon-murid/:id/kategori
```

### Pembayaran

```text
POST /api/calon-murid/:id/pembayaran/midtrans/create
POST /api/calon-murid/:id/pembayaran
GET  /api/calon-murid/:id/pembayaran
```

### Midtrans

```text
POST /api/webhooks/midtrans
```

Endpoint webhook:
- public.
- tidak membutuhkan session.
- wajib signature verification.

### Enrollment

```text
GET /api/enrollment/fields?form_type=data_pribadi
GET /api/calon-murid/:id/enrollment
PUT /api/calon-murid/:id/enrollment
```

### Info

```text
GET /api/konten-tahap/:tahap
GET /api/calon-murid/:id/pengumuman
GET /api/calon-murid/:id/status-wa
```

### Admin

```text
GET/POST /api/admin/jalur
PATCH     /api/admin/jalur/:id
GET       /api/admin/jalur/:id/antrian-fallback
POST      /api/admin/jalur/:id/proses-ulang-antrian

GET/POST  /api/admin/kategori
PATCH     /api/admin/kategori/:id

GET/POST  /api/admin/biaya-pendaftaran
PATCH     /api/admin/biaya-pendaftaran/:id

GET/POST  /api/admin/form-fields
PATCH     /api/admin/form-fields/:id
DELETE    /api/admin/form-fields/:id

GET/POST  /api/admin/konten-tahap
PATCH     /api/admin/konten-tahap/:id

GET       /api/admin/peserta
GET       /api/admin/peserta/:id
PATCH     /api/admin/pembayaran/:id/verifikasi
PATCH     /api/admin/peserta/:id/hasil-assessment
PATCH     /api/admin/peserta/:id/pengumuman
PATCH     /api/admin/peserta/:id/status-wa

GET       /api/admin/laporan/export
```

---

# 11. Validasi

## Email

Gunakan validator email standar.

## Password

Minimal 8 karakter.

## No. WA

Baseline:

```text
^(\+62|62|0)8[1-9][0-9]{6,10}$
```

Tetap lakukan validasi yang masuk akal terhadap format operator Indonesia saat implementasi.

## Status Gate

Backend harus menolak akses tahap yang belum memenuhi syarat.

Contoh:

```text
pembayaran != verified
        ↓
enrollment tidak boleh dibuka
```

Frontend guard bukan pengganti backend authorization.

---

# 12. Environment

Minimal:

```text
Development → Supabase Staging
Preview     → Supabase Staging
Production  → Supabase Production
```

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DATABASE_URL=
DIRECT_URL=

SUPABASE_STORAGE_BUCKET_PEMBAYARAN=bukti-pembayaran
SUPABASE_STORAGE_BUCKET_CMS=konten-cms

NEXT_PUBLIC_APP_URL=

MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=true
```

`DATABASE_URL`:
- pooled connection.
- cocok untuk runtime serverless.

`DIRECT_URL`:
- direct connection.
- digunakan migration Prisma.

Production Midtrans key hanya pada Production.

Jangan pernah memasukkan production key ke:
- Git.
- source code.
- README.
- `.env.example`.
- log.
- screenshot.
- chat.

---

# 13. Deployment

## Staging

1. Buat Supabase staging.
2. Jalankan migration.
3. Set Vercel Preview env.
4. Push branch.
5. Deploy Preview.
6. Test end-to-end.

## Production

1. Pastikan staging lulus.
2. Migration ke Supabase production.
3. Set Vercel Production env.
4. Hubungkan domain resmi.
5. Deploy.
6. Test dengan data dummy.
7. Baru buka ke publik.

---

# 14. Midtrans Production

Karena environment pembayaran menggunakan production/live:

- Server key hanya server-side.
- Client key boleh client-side.
- Snap.js production digunakan.
- Webhook production harus aktif.
- Payment Notification URL:

```text
https://DOMAIN-RESMI/api/webhooks/midtrans
```

Contoh domain yang tercantum pada roadmap:

```text
https://spmb.fitrahinsani.sch.id/api/webhooks/midtrans
```

Jangan menganggap contoh domain sebagai domain final jika domain deployment berbeda.

## Webhook

Wajib:
1. Parse payload.
2. Verifikasi signature.
3. Cari `midtrans_order_id`.
4. Validasi nominal jika diperlukan.
5. Update secara idempotent.
6. Jika settlement/capture → verified.
7. Jika deny/cancel/expire/failure → rejected.
8. Jika pending → pending.
9. Jika verified → lanjutkan state calon murid ke enrollment.
10. Return HTTP 200 jika diproses dengan benar.

---

# 15. UI/UX Principles

- Mobile-first.
- Wali murid mayoritas menggunakan HP.
- Dashboard "Anak Saya" harus sangat jelas.
- Setiap anak memiliki progress/status independen.
- Gunakan progress indicator.
- Status harus menggunakan bahasa yang mudah dipahami.
- Jangan menampilkan istilah teknis seperti `menunggu_kuota_fallback` kepada wali murid.
- Tampilkan label manusiawi: **Menunggu Kuota**.
- Admin dashboard boleh menggunakan status teknis jika membantu operasional.

## Status user-facing

```text
pilih_jalur                → Pilih Jalur
menunggu_verifikasi_bayar  → Menunggu Pembayaran
enrollment                 → Lengkapi Data
menunggu_asesmen           → Menunggu Assessment
menunggu_pengumuman        → Menunggu Pengumuman
diterima                   → Diterima
tidak_diterima             → Tidak Diterima
menunggu_kuota_fallback    → Menunggu Kuota
menunggu_du                → Daftar Ulang
menunggu_join_wa           → Menunggu Diundang
selesai                    → Selesai
```

---

# 16. Struktur Repository

```text
spmb-fila/
├── app/
│   ├── (public)/
│   ├── (wali-murid)/
│   ├── admin/
│   ├── api/
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── wali-murid/
│   └── admin/
│
├── lib/
│   ├── prisma.ts
│   ├── auth/
│   ├── supabase/
│   ├── midtrans/
│   ├── quota/
│   ├── payments/
│   └── utils/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── types/
├── public/
│
├── docs/
│   ├── SPMB-FILA-SPEC.md
│   └── ...
│
├── AGENTS.md
├── .env.example
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

# 17. Development Order

Codex wajib mengerjakan secara bertahap:

### Phase 0 — Bootstrap
- Next.js.
- TypeScript.
- Tailwind.
- Prisma.
- Supabase connection.
- Environment.
- Lint/typecheck/build.

### Phase 1 — Database
- Prisma schema.
- Migration staging.
- Seed data development.
- Constraints.
- Index.
- Audit log.

### Phase 2 — Auth
- Supabase Auth.
- Login.
- Register.
- Logout.
- Reset password.
- Role admin/wali.
- Middleware/authorization.

### Phase 3 — Master Data
- Jalur.
- Kategori.
- Kuota.
- Matrix biaya.
- Admin CRUD.

### Phase 4 — Calon Murid
- Dashboard Anak Saya.
- Tambah anak.
- Pilih jalur.
- Pilih kategori.
- Quota transaction.

### Phase 5 — Payment
- Midtrans create transaction.
- Snap.
- Webhook.
- Idempotency.
- Payment status.
- Enrollment gate.

### Phase 6 — Enrollment
- Form builder dasar.
- Data pribadi.
- Observasi.
- Draft.
- Final submit.
- Auto-fill.

### Phase 7 — Assessment & Announcement
- CMS.
- Assessment info.
- Assessment result.
- Announcement.
- Release date.

### Phase 8 — Fallback
- TCP → Reguler.
- FIFO.
- Reprocess.
- Audit.
- UI status Menunggu Kuota.

### Phase 9 — DU & Join WA
- DU upload.
- Preview bukti dan verifikasi manual admin.
- Admin menyediakan link grup setelah DU terverifikasi.
- Wali membuka link dan wajib mengonfirmasi sudah bergabung.
- Konfirmasi wali mengubah status pendaftaran menjadi selesai.

### Phase 10 — Reporting
- Filter.
- Excel/CSV export.

### Phase 11 — Testing
- Unit.
- Integration.
- E2E.
- Authorization.
- Race condition.
- Webhook idempotency.
- Auto-transfer.
- Auto-delete.
- Multi-child account.

### Phase 12 — Production
- Supabase production.
- Vercel production.
- Midtrans production.
- Domain.
- Final smoke test.

---

# 18. Definition of Done MVP

MVP dianggap selesai jika:

- Wali dapat register/login.
- Satu akun dapat memiliki lebih dari satu anak.
- Jalur/kategori/kuota dapat dikelola admin.
- Matrix biaya dapat dikelola admin.
- User tidak dapat menentukan nominal pembayaran.
- Pembayaran pendaftaran berjalan melalui Midtrans.
- Webhook mengubah status pembayaran dengan benar.
- Enrollment hanya terbuka setelah pembayaran verified.
- Form enrollment dapat dikelola.
- Assessment dapat dikelola.
- Announcement dapat dikelola.
- TCP fallback ke Reguler berjalan.
- Reguler penuh menghasilkan Menunggu Kuota.
- FIFO berjalan.
- Penambahan kuota memproses antrian.
- Auto-delete hanya memengaruhi calon murid yang gagal.
- Akun dan anak lain tetap aman.
- DU manual berjalan.
- Join WA manual berjalan.
- Export laporan berjalan.
- Race condition test lulus.
- Security/authorization test lulus.
- Production environment terpisah dari staging.

---

# 19. Aturan untuk Codex

Codex harus:
- membaca `AGENTS.md` sebelum coding.
- membaca dokumen di `docs/` sebelum mengubah domain terkait.
- membuat perubahan kecil dan terukur.
- menjalankan lint/typecheck/test setelah perubahan relevan.
- tidak mengubah business rule tanpa persetujuan.
- tidak membuat fitur Phase 2 selama MVP belum selesai.
- tidak hardcode nominal pembayaran.
- tidak percaya data sensitif dari browser.
- tidak expose secret.
- tidak menghapus migration yang sudah diterapkan tanpa alasan kuat.
- tidak mengubah schema database secara destruktif tanpa menjelaskan konsekuensi.
- menjaga backward compatibility bila memungkinkan.
- menambahkan test untuk business rule kritis.

Jika requirement ambigu:
1. cari di dokumen.
2. cek business rule.
3. jangan menebak jika berdampak pada data/keuangan.
4. berhenti dan minta keputusan jika diperlukan.

---

# 20. Catatan Risiko

Risiko tertinggi:
1. Production Midtrans key.
2. Race condition kuota.
3. Webhook duplicate/failure.
4. Authorization antar akun.
5. Auto-delete.
6. Migration production.
7. Kebocoran Supabase service role.
8. Ketidaksesuaian nominal pembayaran.
9. Status calon murid melompati tahap.

Semua risiko tersebut harus memiliki test atau guard yang sesuai.

---

# 21. Open Decisions yang Tidak Boleh Ditebak Codex

Jika muncul pertanyaan baru yang tidak tercakup dokumen:

- Jangan membuat asumsi bisnis sendiri.
- Catat sebagai `Open Decision`.
- Jelaskan dampak teknis.
- Tunggu keputusan sebelum implementasi jika keputusan memengaruhi schema, pembayaran, kuota, atau penghapusan data.
