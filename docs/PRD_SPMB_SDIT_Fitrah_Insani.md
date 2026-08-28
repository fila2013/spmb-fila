# PRD — Sistem SPMB SDIT Fitrah Insani Langkapura

**Versi:** 3.0 (Draft)
**Tanggal:** 27 Agustus 2026
**Status:** Draft — mayoritas keputusan scope sudah final, siap direview tim dev
**Author:** —

---

## 1. Latar Belakang

SDIT Fitrah Insani Langkapura saat ini menjalankan proses SPMB (Sistem Penerimaan Murid Baru) secara manual/tersebar (form fisik, WA, spreadsheet). Dibutuhkan **aplikasi web baru** yang mendigitalkan seluruh alur ini — dari pembuatan akun, pemilihan jalur & kategori pendaftar, pembayaran, enrollment, asesmen, pengumuman, hingga daftar ulang — dengan dua peran utama: **Wali Murid** dan **Admin/Panitia SPMB**. Sebagian besar konten (jalur, kategori, kuota, form enrollment, dan informasi tahap asesmen/pengumuman/DU/join grup) dikelola sepenuhnya oleh Admin agar sistem fleksibel dipakai lintas tahun ajaran tanpa perlu ubah kode.

## 2. Tujuan (Goals)

- Wali murid mendaftar & memantau status pendaftaran seluruh anaknya (bisa lebih dari satu) dalam satu akun.
- Admin mengelola seluruh proses SPMB — termasuk membuka/menutup jalur & kategori, mengatur kuota, mengatur form enrollment, dan mempublikasikan informasi tiap tahap — dari satu dashboard tanpa bantuan developer.
- Meminimalkan input berulang bagi wali murid dengan auto-fill data yang sudah pernah diisi sebelumnya (email akun, asal TK).
- Menyiapkan proses yang siap berkembang ke payment gateway (Midtrans) di iterasi berikutnya, tanpa membangunnya di v1.

## 3. Non-Goals (Out of Scope untuk v1)

- **Midtrans / payment gateway** — **sepenuhnya ditunda ke v2, dibangun dari nol saat v2 dimulai**. Tidak ada skeleton/persiapan API di v1. V1 murni upload bukti bayar manual + verifikasi admin.
- Role terpisah untuk Bendahara/Tim Asesor (v1 hanya Wali Murid & Admin).
- Multi-tenant / multi-sekolah.
- Notifikasi otomatis via WA Blast/API.
- Pembuatan grup WhatsApp otomatis (tetap manual oleh admin, sistem hanya mencatat status).
- Bulk-update hasil kelulusan via upload Excel (tetap input manual satu-satu oleh admin — lihat 6.6).

## 4. Actors & Roles

| Role | Deskripsi | Akses |
|---|---|---|
| **Wali Murid** | Orang tua/wali; **satu akun bisa mendaftarkan lebih dari satu anak** | Registrasi (email & password), login, tambah calon murid (anak), isi form per anak, upload bukti bayar, lihat status tiap anak |
| **Admin/Panitia SPMB** | Pengelola proses SPMB | Login dashboard, kelola master data (jalur, kategori, kuota, form, konten tahap 5–8), verifikasi pembayaran, kelola hasil asesmen & pengumuman, kelola status DU & grup WA, export laporan |

## 5. Alur Pengguna End-to-End (Wali Murid)

```
1. Registrasi Akun (EMAIL & PASSWORD)
   ↓
2. Login → Dashboard "Anak Saya" → Tambah Calon Murid (anak ke-1, ke-2, dst.)
   ↓
3. Pilih Jalur: TCP / Reguler / Pindahan
   [aktif/nonaktif, berjadwal, & berkuota — diatur admin; jalur penuh/kuota habis = otomatis tertutup]
   ↓
4. Pilih Kategori Pendaftar (tergantung yang diaktifkan admin):
   a. Alumni TKIT → radio TETAP: "TKIT Fitrah Insani 1" / "TKIT Fitrah Insani 2" (tidak bisa diedit admin)
   b. Eksternal/Umum → isi sendiri nama TK asal (free text)
   [kategori juga aktif/nonaktif, berjadwal, & berkuota — diatur admin]
   ↓
5. Bayar Biaya Pendaftaran
   → Upload Bukti Pembayaran (status: Menunggu Verifikasi → Terverifikasi/Ditolak)
   ↓ (setelah status pembayaran = Terverifikasi)
6. Enrollment (form muncul hanya untuk peserta yang sudah bayar):
   a. Data Pribadi Anak & Orang Tua — **Email & Asal TK otomatis terisi** dari data akun & pilihan kategori sebelumnya; No. WA divalidasi format Indonesia
   b. Data Observasi — 10 pertanyaan (dikelola Admin)
   ↓
7. Assessment — lihat info tahap (tanggal per kategori, dikelola Admin)
   ↓
8. Announcement — lihat status Diterima/Tidak (diinput admin satu-satu) + konten pengumuman
   ↓ (jika diterima)
9. Admission Fee (DU) — lihat info & upload bukti bayar DU 50%
   ↓
10. Join With Us — lihat info status join grup WA
```

## 6. Functional Requirements (Detail per Modul)

### 6.1 Modul Akun & Multi-Anak
- FR-1.1 Registrasi akun wali murid **wajib menggunakan email & password**.
- FR-1.2 Validasi: email unik & valid, password minimal 8 karakter.
- FR-1.3 Login/logout, reset password via email.
- FR-1.4 **Satu akun wali murid dapat menambahkan lebih dari satu Calon Murid (anak)** — dashboard menampilkan daftar anak, masing-masing dengan alur & status independen.
- FR-1.5 Admin memiliki akun terpisah dengan hak akses dashboard admin.

### 6.2 Modul Jalur & Kategori Pendaftar (dengan Kuota)

**Jalur (TCP / Reguler / Pindahan)**
- FR-2.1 Wali murid memilih satu jalur per anak.
- FR-2.2 Admin dapat mengaktifkan/menonaktifkan tiap jalur secara independen, terlepas dari tanggal.
- FR-2.3 Admin dapat mengatur periode buka-tutup otomatis per jalur.
- FR-2.4 **Kuota per Jalur**: Admin menentukan kuota maksimal, dapat menambah/mengurangi kuota kapan saja. Sistem mengurangi kuota terpakai setiap ada pendaftar baru pada jalur tsb. Saat kuota tercapai, jalur otomatis berstatus "Penuh" dan tidak bisa dipilih wali murid baru (tanpa perlu admin menonaktifkan manual, meski admin tetap bisa override/menutup lebih awal secara manual).

**Kategori Pendaftar (Alumni TKFI / Eksternal)**
- FR-2.5 Wali murid memilih kategori setelah jalur:
  - **Alumni TKIT** → **2 radio button tetap dan tidak dapat diedit admin**: "TKIT Fitrah Insani 1" dan "TKIT Fitrah Insani 2".
  - **Eksternal/Umum** → isi sendiri nama TK asal (free text, akan dipakai untuk auto-fill di Enrollment).
- FR-2.6 Admin dapat mengaktifkan/menonaktifkan tiap kategori secara independen.
- FR-2.7 Admin mengatur periode buka-tutup per kategori.
- FR-2.8 **Kuota per Kategori**: sama seperti FR-2.4, admin atur kuota, sistem otomatis menutup pendaftaran kategori saat kuota tercapai.
- FR-2.9 Admin dapat melihat sisa kuota real-time (kuota maksimal vs. terpakai) untuk tiap Jalur maupun Kategori dari dashboard.

### 6.3 Modul Pembayaran Pendaftaran (v1 — Manual)
- FR-3.1 Wali murid mengunggah bukti pembayaran (gambar/PDF, batas ukuran file) per anak.
- FR-3.2 Status: **Menunggu Verifikasi** → **Terverifikasi** / **Ditolak** (dengan catatan admin bila ditolak, wali murid bisa unggah ulang).
- FR-3.3 Admin memverifikasi/menolak dari dashboard.
- FR-3.4 Tahap Enrollment (6.4) hanya terbuka untuk anak dengan status pembayaran **Terverifikasi**.
- FR-3.5 *(Catatan roadmap, bukan scope v1)* Integrasi Midtrans akan dirancang & dibangun terpisah saat v2 dimulai; tidak ada persiapan struktur data/API untuk itu di v1.

### 6.4 Modul Enrollment (Form Builder oleh Admin + Auto-fill)
- FR-4.1 Admin dapat menambah, mengubah, menghapus, dan mengatur urutan field pada dua form:
  - **Data Pribadi Anak & Orang Tua** — default: Nama Lengkap, Nama Panggilan, TTL, Nama Ayah, Nama Ibu, **Email Ayah/Ibu**, No. WA Ayah, No. WA Bunda, **Asal TK**.
  - **Data Observasi** — default 10 pertanyaan esai, dapat ditambah/diubah/dihapus admin.
- FR-4.2 Tiap field memiliki tipe input, status wajib/opsional, dan urutan tampil, diatur admin.
- FR-4.3 **Validasi No. WA**: wajib mengikuti format nomor telepon Indonesia (contoh: diawali 08 atau +62, hanya angka, panjang sesuai standar operator Indonesia). Field ini tervalidasi otomatis sebelum submit.
- FR-4.4 **Auto-fill**: saat form Data Pribadi dibuka pertama kali,
  - field **Email** otomatis terisi dari email akun wali murid yang login (dapat diedit bila ternyata beda dengan email ortu yang dituju),
  - field **Asal TK** otomatis terisi dari pilihan kategori pendaftar di tahap 4 (nama TKIT FI 1/2 jika Alumni, atau teks yang diisi sendiri jika Eksternal) — bersifat pre-filled dan dapat dikoreksi bila perlu.
- FR-4.5 Form Enrollment hanya muncul/dapat diisi untuk calon murid yang pembayaran pendaftarannya sudah Terverifikasi.
- FR-4.6 Wali murid dapat mengisi bertahap (simpan draft) sebelum submit final.
- FR-4.7 Admin melihat daftar seluruh peserta terdaftar yang telah melakukan pembayaran, lengkap dengan status pengisian enrollment.

### 6.5 Modul Informasi Tahap: Assessment & Announcement (dikelola Admin sebagai konten)
- FR-5.1 Admin dapat membuat/mengedit konten untuk tahap Assessment & Announcement: judul, tanggal/periode, isi teks (rich text), gambar, dan urutan layout blok konten.
- FR-5.2 **Assessment**: admin menambahkan info tanggal per kategori (contoh: "26 September 2026 — TKIT FILA", "3 Oktober 2026 — Umum"). Wali murid melihat info sesuai kategori & jalur anaknya.
- FR-5.3 **Announcement**: 
  - Status kelulusan **per calon murid** (Diterima/Tidak Diterima) **diinput admin secara manual satu per satu** (bukan bulk upload).
  - Admin menjadwalkan tanggal rilis; status baru terlihat wali murid setelah tanggal rilis tersebut.
  - Konten teks/gambar pengumuman (dari CMS) tampil sebagai pesan pendamping status per anak.

### 6.6 Modul Admission Fee & Join With Us (dikelola Admin sebagai konten)
- FR-6.1 Admin menambahkan info kebijakan DU (nominal/persentase, periode bayar, teks pemberitahuan) — hanya terlihat wali murid yang anaknya berstatus Diterima.
- FR-6.2 Wali murid mengunggah bukti bayar DU; status Menunggu Verifikasi → Terverifikasi/Ditolak, sama seperti pembayaran pendaftaran.
- FR-6.3 Admin menambahkan info proses invite grup WA (teks pemberitahuan).
- FR-6.4 Status join grup (Menunggu Diundang/Sudah Diundang) per calon murid diupdate manual oleh admin, ditampilkan berdampingan dengan konten info.

## 7. Admin Dashboard & Pelaporan
- FR-7.1 Daftar seluruh calon murid dengan filter: jalur, kategori, status pembayaran, status enrollment, status asesmen, status kelulusan, status DU, status grup WA.
- FR-7.2 Detail per calon murid: seluruh data terisi + riwayat pembayaran + wali murid terkait.
- FR-7.3 Pengelolaan master data: CRUD Jalur & Kategori (toggle aktif, periode, **kuota**), Form Builder, CMS konten tahap 5–8.
- FR-7.4 **Export Laporan ke Excel**: admin dapat mencetak/mengunduh rekap data pendaftar (termasuk khusus rekap hasil pengumuman/kelulusan) dalam format Excel/CSV sebagai laporan data ke yayasan/pihak terkait.

## 8. Data Model (Entitas Utama, v3)

| Entitas | Field Kunci |
|---|---|
| **User (Wali Murid/Admin)** | id, email, password_hash, role (wali_murid/admin), created_at |
| **CalonMurid (Anak)** | id, user_id (FK), nama_anak, jalur_id, kategori_id, sub_kategori (tkit_fi_1/tkit_fi_2/asal_tk_text), status_keseluruhan |
| **Jalur** | id, nama, status_aktif, periode_mulai, periode_selesai, **kuota_maks, kuota_terpakai** |
| **KategoriPendaftar** | id, nama, status_aktif, periode_mulai, periode_selesai, **kuota_maks, kuota_terpakai** |
| **FormField** | id, form_type (data_pribadi/observasi), label, tipe_input, validasi (mis. `format_wa_indonesia`), wajib, urutan, **auto_fill_source** (nullable: `akun_email` / `kategori_asal_tk`) |
| **FormResponse** | id, calon_murid_id, field_id, value |
| **Pembayaran** | id, calon_murid_id, jenis (pendaftaran/DU), file_bukti, status (pending/verified/rejected), catatan_admin, verified_by, verified_at |
| **KontenTahap** | id, tahap (assessment/announcement/admission_fee/join_wa), judul, tanggal, isi_teks, gambar_url, urutan_layout, status_aktif |
| **HasilAssessment** | calon_murid_id, status, catatan |
| **Pengumuman** | calon_murid_id, status_akhir (diterima/tidak), tanggal_rilis |
| **StatusGrupWA** | calon_murid_id, status (menunggu/sudah_diundang), updated_at |

*Catatan: field terkait Midtrans (transaction_id, snap_token, metode_pembayaran) sengaja TIDAK dimasukkan di v1, sesuai keputusan Non-Goals bagian 3.*

## 9. Business Rules (contoh tahun ajaran 2026/2027, semua configurable oleh Admin)

- Jalur & Kategori bisa dibuka/ditutup admin kapan saja, di luar/di dalam periode tanggal yang sudah diset, dan otomatis tertutup saat kuota tercapai.
- Contoh periode kategori: 1–14 Sept (Alumni TKFI), 15–26 Sept (Eksternal).
- Pilihan Alumni TKIT selalu tetap 2 opsi: TKIT Fitrah Insani 1 & TKIT Fitrah Insani 2 (hardcoded, tidak configurable).
- Assessment: 26 Sept 2026 (TKIT FILA), 3 Okt 2026 (Umum) — dikelola sebagai konten oleh admin.
- Announcement: 17 Oktober 2026 — status per anak diinput manual admin + konten pengumuman dari admin.
- DU (50%): 19 Oktober – 30 November 2026 — dikelola sebagai konten oleh admin.
- Enrollment hanya terbuka setelah pembayaran pendaftaran Terverifikasi.
- No. WA pada form Data Pribadi wajib format Indonesia yang valid.
- Email & Asal TK pada form Data Pribadi otomatis ter-prefill, tetap dapat diedit wali murid.

## 10. Non-Functional Requirements

- **Keamanan:** password ter-hash, upload file dibatasi tipe & ukuran, data calon murid hanya bisa diakses oleh wali murid pemilik akun & admin.
- **Usability:** dashboard "Anak Saya" yang jelas untuk akun dengan banyak anak; progress indicator per anak per tahap; indikator sisa kuota untuk wali murid saat memilih jalur/kategori.
- **Konsistensi data:** pengurangan/penambahan kuota harus atomik (hindari race condition saat banyak pendaftar submit bersamaan mendekati kuota habis).
- **Ketersediaan:** sistem tetap dapat diakses saat lonjakan trafik (pembukaan jalur/kategori, hari pengumuman).
- **Auditability:** setiap perubahan status oleh admin (verifikasi bayar, hasil asesmen, kelulusan, toggle jalur/kategori, perubahan kuota) tercatat waktu & pelakunya.
- **Responsive:** mayoritas wali murid mengakses dari HP.

## 11. Ringkasan Keputusan (sudah final untuk v1)

| Topik | Keputusan |
|---|---|
| Midtrans | Ditunda total ke v2, dibangun dari nol, tidak ada skeleton di v1 |
| Pilihan Alumni TKIT | Tetap 2 radio button (TKIT FI 1 & 2), tidak dapat diedit admin |
| Kuota Jalur/Kategori | Admin bisa atur, tambah, kurangi kuota; pendaftaran otomatis tertutup saat kuota habis |
| Validasi No. WA | Wajib format nomor Indonesia |
| Auto-fill | Email (dari akun) & Asal TK (dari pilihan kategori) otomatis terisi di form Data Pribadi |
| Input kelulusan | Manual satu-satu oleh admin per anak (bukan bulk Excel) |
| Laporan | Admin bisa export/cetak rekap data (termasuk hasil pengumuman) ke Excel |

*(Bagian Open Questions dari draft sebelumnya sudah terjawab semua dan dipindahkan ke tabel di atas. Jika ada pertanyaan baru yang muncul saat development, tambahkan di sini.)*

## 12. Success Metrics

- % pendaftar yang menyelesaikan seluruh alur (akun → DU terverifikasi) tanpa bantuan manual dari panitia.
- Waktu rata-rata verifikasi pembayaran oleh admin.
- Jumlah pertanyaan berulang ke panitia terkait status pendaftaran (target: menurun).
- Akurasi data (berkurangnya kesalahan input No. WA/email berkat validasi & auto-fill).

---

*Dokumen ini adalah draft v3. Siap dijadikan acuan pembuatan technical spec/wireframe oleh tim development.*
