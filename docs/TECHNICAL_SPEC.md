# Technical Spec — Sistem SPMB SDIT Fitrah Insani Langkapura

**Versi:** 1.5 — Tambahan §5B: status antrian `menunggu_kuota_fallback` saat kuota Reguler penuh (bukan langsung "Tidak Diterima"), lengkap proses ulang antrian otomatis
**Turunan dari:** PRD v3
**Tanggal:** 27 Agustus 2026

---

## 1. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | **Next.js (React) + TypeScript** | Routing & form-heavy app cocok dengan App Router; satu repo full-stack |
| Styling | Tailwind CSS | Cepat untuk form-heavy admin dashboard & wireframe-to-production |
| Backend / API | **Next.js API Routes / Route Handlers** | Deploy satu kesatuan dengan frontend di Vercel, tanpa server terpisah |
| Hosting Web App & API | **Vercel** | Deploy otomatis dari Git, cocok native dengan Next.js, auto-scaling untuk lonjakan trafik saat pembukaan jalur/pengumuman |
| Database | **PostgreSQL via Supabase** | Managed Postgres, sudah termasuk backup & connection pooling, tanpa perlu kelola server DB sendiri |
| ORM | Prisma (connect ke Supabase Postgres connection string) | Migration & type-safety, tetap kompatibel dengan Supabase |
| Auth | **Supabase Auth** (email & password) | Satu ekosistem dengan database, sudah ada session/JWT, reset password via email siap pakai — mengurangi effort dibanding membangun auth sendiri |
| File Storage | **Supabase Storage** | Untuk upload bukti pembayaran (pendaftaran & DU) dan gambar konten CMS; terintegrasi langsung dengan auth Supabase untuk aturan akses |
| Deployment | Push ke Git → auto-deploy Vercel; migration Prisma dijalankan terpisah ke Supabase | CI/CD sederhana untuk tim kecil |

> Semua layer di atas berada di dua penyedia: **Vercel** (aplikasi) dan **Supabase** (database + storage + auth) — memudahkan pengelolaan tanpa banyak vendor.

## 2. Arsitektur Sistem (High-Level)

```
┌─────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│  Web App (Wali   │ HTTPS  │   Next.js API Routes  │        │  Supabase            │
│  Murid & Admin)  │◄──────►│   (deploy di Vercel)   │◄──────►│  - PostgreSQL DB      │
│  Next.js SPA/SSR │        │                        │        │  - Auth (email/pass)  │
│  (deploy Vercel)  │        │  - Validasi kuota      │        │  - Storage (bukti     │
└─────────────────┘        │    (transaction DB)   │        │    bayar, gambar CMS) │
                            │  - Panggil Supabase    │        └────────────────────┘
                            │    client (service role│
                            │    key di server)      │
                            └──────────────────────┘
```

- **Payment gateway Midtrans (Snap) sudah diintegrasikan** untuk pembayaran **pendaftaran** (produksi/live, bukan sandbox). Pembayaran **DU tetap manual** (upload bukti + verifikasi admin) — lihat Bagian 4.
- Akses ke Supabase (DB & Storage) dari **server-side saja** (Next.js API Routes) memakai *service role key*, bukan langsung dari browser — supaya validasi kuota, aturan status bertahap, dan hak akses admin tetap sepenuhnya dikontrol backend, bukan bergantung pada Row Level Security di client.
- Semua state kuota (Jalur/Kategori) dikelola di backend dengan **row-level lock / transaction** saat submit pendaftaran, agar tidak race condition ketika kuota mepet.
- `MIDTRANS_SERVER_KEY` **hanya pernah dipakai server-side** (Next.js API Route), tidak pernah dikirim ke browser. Hanya `MIDTRANS_CLIENT_KEY` yang boleh ada di client (dipakai untuk memuat skrip Snap.js).

## 3. Database Schema (PostgreSQL DDL)

```sql
-- ================= USERS =================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('wali_murid','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= JALUR =================
CREATE TABLE jalur (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama           VARCHAR(50) NOT NULL,          -- TCP / Reguler / Pindahan
  status_aktif   BOOLEAN NOT NULL DEFAULT true,
  periode_mulai  DATE,
  periode_selesai DATE,
  kuota_maks     INTEGER,                        -- NULL = tidak dibatasi
  kuota_terpakai INTEGER NOT NULL DEFAULT 0,
  -- ATURAN OTOMATIS ANTAR-JALUR (baru):
  fallback_jalur_id UUID REFERENCES jalur(id),
    -- jika calon murid TIDAK DITERIMA di jalur ini, otomatis dipindah ke jalur yang ditunjuk di sini.
    -- NULL = tidak ada fallback (kegagalan berarti benar-benar gagal di jalur ini).
    -- Contoh: jalur TCP → fallback_jalur_id mengarah ke jalur Reguler.
  hapus_data_jika_gagal BOOLEAN NOT NULL DEFAULT false,
    -- jika true: saat calon murid TIDAK DITERIMA di jalur ini, hapus HANYA data calon_murid ini
    -- (beserta enrollment, pembayaran, hasil asesmen, dst. miliknya sendiri — via cascade FK).
    -- TIDAK menghapus akun wali murid, dan TIDAK menyentuh anak lain di akun yang sama.
    -- Berlaku terlepas dari apakah calon murid daftar langsung atau sampai di jalur ini lewat transfer.
    -- Contoh: diaktifkan di jalur Reguler & Pindahan. Jalur TCP dibiarkan false karena
    -- kegagalan di TCP ditangani lewat fallback_jalur_id (pindah, bukan hapus) — lihat §5B & §5C.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= BIAYA PENDAFTARAN (matrix Jalur × Kategori) =================
CREATE TABLE biaya_pendaftaran (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jalur_id       UUID NOT NULL REFERENCES jalur(id),
  kategori_id    UUID NOT NULL REFERENCES kategori_pendaftar(id),
  nominal        INTEGER NOT NULL,   -- dalam Rupiah, contoh: 450000
  status_aktif   BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(jalur_id, kategori_id)
);

-- ================= KATEGORI PENDAFTAR =================
CREATE TABLE kategori_pendaftar (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama           VARCHAR(50) NOT NULL,           -- Alumni TKFI / Eksternal-Umum
  tipe           VARCHAR(20) NOT NULL CHECK (tipe IN ('alumni_tkfi','eksternal')),
  status_aktif   BOOLEAN NOT NULL DEFAULT true,
  periode_mulai  DATE,
  periode_selesai DATE,
  kuota_maks     INTEGER,
  kuota_terpakai INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= CALON MURID =================
CREATE TABLE calon_murid (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_anak         VARCHAR(150) NOT NULL,
  jalur_id          UUID NOT NULL REFERENCES jalur(id),
  kategori_id       UUID NOT NULL REFERENCES kategori_pendaftar(id),
  -- sub_kategori: 'tkit_fi_1' | 'tkit_fi_2' (fixed, hanya utk alumni) ATAU teks bebas (eksternal)
  sub_kategori_enum VARCHAR(20) CHECK (sub_kategori_enum IN ('tkit_fi_1','tkit_fi_2')),
  sub_kategori_text VARCHAR(150),                -- asal TK, khusus eksternal
  -- PENANDA AUTO-TRANSFER (baru):
  jalur_asal_id     UUID REFERENCES jalur(id),   -- NULL = daftar langsung di jalur saat ini;
                                                   -- terisi = pindah otomatis dari jalur ini (mis. dari TCP).
                                                   -- Kolom ini untuk PELACAKAN/AUDIT saja — tidak lagi
                                                   -- menjadi syarat aturan hapus data (lihat §5C).
  menunggu_fallback_jalur_id UUID REFERENCES jalur(id),
                                                   -- terisi jika auto-transfer (§5B) gagal karena kuota
                                                   -- jalur tujuan penuh — menandai "mengantri" untuk jalur ini.
                                                   -- NULL kembali setelah berhasil dipindah atau dibatalkan admin.
  status_keseluruhan VARCHAR(30) NOT NULL DEFAULT 'pilih_jalur'
    CHECK (status_keseluruhan IN (
      'pilih_jalur','menunggu_verifikasi_bayar','enrollment',
      'menunggu_asesmen','menunggu_pengumuman',
      'diterima','tidak_diterima','menunggu_kuota_fallback',
      'menunggu_du','menunggu_join_wa','selesai'
    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= FORM BUILDER =================
CREATE TABLE form_field (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type        VARCHAR(20) NOT NULL CHECK (form_type IN ('data_pribadi','observasi')),
  label            VARCHAR(150) NOT NULL,
  tipe_input       VARCHAR(20) NOT NULL CHECK (tipe_input IN ('text','textarea','date','number','email','tel')),
  wajib            BOOLEAN NOT NULL DEFAULT true,
  urutan           INTEGER NOT NULL DEFAULT 0,
  validasi         VARCHAR(50),                   -- e.g. 'format_wa_indonesia'
  auto_fill_source VARCHAR(30),                    -- 'akun_email' | 'kategori_asal_tk' | NULL
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE form_response (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calon_murid_id UUID NOT NULL REFERENCES calon_murid(id) ON DELETE CASCADE,
  field_id       UUID NOT NULL REFERENCES form_field(id),
  value          TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(calon_murid_id, field_id)
);

-- ================= PEMBAYARAN =================
CREATE TABLE pembayaran (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calon_murid_id    UUID NOT NULL REFERENCES calon_murid(id) ON DELETE CASCADE,
  jenis             VARCHAR(20) NOT NULL CHECK (jenis IN ('pendaftaran','du')),
  metode_pembayaran VARCHAR(20) NOT NULL DEFAULT 'manual_transfer'
                      CHECK (metode_pembayaran IN ('manual_transfer','midtrans')),
  file_bukti_url    TEXT,          -- diisi jika metode manual_transfer (path di Supabase Storage)
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','verified','rejected')),
  catatan_admin     TEXT,
  verified_by       UUID REFERENCES users(id),   -- NULL jika status berubah otomatis lewat webhook Midtrans
  verified_at       TIMESTAMPTZ,
  -- kolom khusus Midtrans:
  midtrans_order_id       VARCHAR(100) UNIQUE,    -- order_id yang dikirim ke Midtrans, format: PDF-<calon_murid_id short>-<timestamp>
  midtrans_transaction_id VARCHAR(100),           -- transaction_id dari respons Midtrans
  midtrans_snap_token     TEXT,                   -- token Snap untuk sesi popup pembayaran
  midtrans_payment_type   VARCHAR(30),             -- mis. 'bank_transfer', 'qris', 'gopay', dst.
  midtrans_raw_payload    JSONB,                  -- simpan payload notifikasi terakhir untuk audit/debug
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= KONTEN TAHAP (CMS) =================
CREATE TABLE konten_tahap (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tahap          VARCHAR(20) NOT NULL CHECK (tahap IN ('assessment','announcement','admission_fee','join_wa')),
  judul          VARCHAR(200) NOT NULL,
  tanggal        DATE,
  isi_teks       TEXT,
  gambar_url     TEXT,
  urutan_layout  INTEGER NOT NULL DEFAULT 0,
  status_aktif   BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= HASIL ASSESSMENT =================
CREATE TABLE hasil_assessment (
  calon_murid_id UUID PRIMARY KEY REFERENCES calon_murid(id) ON DELETE CASCADE,
  status         VARCHAR(20) CHECK (status IN ('belum','hadir','tidak_hadir')),
  catatan        TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= PENGUMUMAN =================
CREATE TABLE pengumuman (
  calon_murid_id UUID PRIMARY KEY REFERENCES calon_murid(id) ON DELETE CASCADE,
  status_akhir   VARCHAR(20) CHECK (status_akhir IN ('diterima','tidak_diterima')),
  tanggal_rilis  DATE,
  updated_by     UUID REFERENCES users(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= STATUS GRUP WA =================
CREATE TABLE status_grup_wa (
  calon_murid_id UUID PRIMARY KEY REFERENCES calon_murid(id) ON DELETE CASCADE,
  status         VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','sudah_diundang')),
  updated_by     UUID REFERENCES users(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index penting
CREATE INDEX idx_calon_murid_user ON calon_murid(user_id);
CREATE INDEX idx_calon_murid_jalur ON calon_murid(jalur_id);
CREATE INDEX idx_calon_murid_kategori ON calon_murid(kategori_id);
CREATE INDEX idx_pembayaran_calon_murid ON pembayaran(calon_murid_id);
CREATE INDEX idx_form_response_calon_murid ON form_response(calon_murid_id);
```

> Kolom `midtrans_order_id` diberi index `UNIQUE` agar aman dipakai sebagai idempotency key saat webhook Midtrans terkirim lebih dari sekali (Midtrans dapat mengirim notifikasi duplikat).

## 4. Logika Kuota (Kritis — harus atomik)

Kuota harus dicegah dari race condition saat banyak wali murid submit hampir bersamaan mendekati kuota habis. Gunakan transaksi DB dengan row lock:

```sql
BEGIN;

SELECT kuota_maks, kuota_terpakai
FROM jalur
WHERE id = :jalur_id
FOR UPDATE;  -- row lock

-- di aplikasi: cek IF kuota_maks IS NOT NULL AND kuota_terpakai >= kuota_maks → REJECT

UPDATE jalur
SET kuota_terpakai = kuota_terpakai + 1
WHERE id = :jalur_id;

-- ulangi pola yang sama untuk kategori_pendaftar

COMMIT;
```

Endpoint pemilihan jalur/kategori **wajib** membungkus insert `calon_murid` dan update kuota dalam satu transaksi yang sama.

## 5. Aturan Bisnis Otomatis: Biaya per Jalur×Kategori, Auto-Transfer TCP→Reguler, & Auto-Delete Data Calon Murid

### 5A. Biaya Pendaftaran Dinamis (Matrix Jalur × Kategori)

- Admin mengatur nominal biaya pendaftaran untuk **setiap kombinasi Jalur × Kategori** lewat tabel `biaya_pendaftaran` (contoh: Jalur TCP + Kategori Alumni TKIT = Rp 450.000).
- **Wali murid tidak pernah mengisi nominal sendiri** — nominal diambil otomatis oleh backend dari tabel ini saat membuat transaksi Midtrans (§6.3 kode `create-transaction` diupdate, lihat di bawah).
- **Validasi wajib:** sebelum wali murid diarahkan ke halaman pembayaran, backend mengecek apakah kombinasi jalur+kategori yang dipilih sudah punya baris `biaya_pendaftaran` dengan `status_aktif = true`. Jika belum ada (admin lupa mengisi), tampilkan pesan "Biaya belum diatur, hubungi panitia" — **jangan** biarkan wali murid lanjut ke Midtrans tanpa nominal yang jelas.
- Endpoint admin baru:

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/admin/biaya-pendaftaran` | List/tambah nominal per kombinasi jalur+kategori |
| PATCH | `/api/admin/biaya-pendaftaran/:id` | Update nominal / status aktif |

- **Update kode `create-transaction` (§6.3)** — bagian `grossAmount` yang sebelumnya hardcode diganti:

```ts
// Ganti bagian ini di endpoint create-transaction:
const { data: biaya } = await supabaseServer
  .from("biaya_pendaftaran")
  .select("nominal")
  .eq("jalur_id", calonMurid.jalur_id)
  .eq("kategori_id", calonMurid.kategori_id)
  .eq("status_aktif", true)
  .single();

if (!biaya) {
  return Response.json(
    { error: "Biaya pendaftaran untuk kombinasi jalur & kategori ini belum diatur admin." },
    { status: 422 }
  );
}
const grossAmount = biaya.nominal; // bukan lagi hardcode 500_000
```

### 5B. Auto-Transfer Jalur TCP → Reguler Saat Tidak Diterima

**Aturan:** khusus jalur yang punya `fallback_jalur_id` terisi (contoh: TCP → Reguler). Saat admin menandai calon murid di jalur tsb sebagai **Tidak Diterima**, sistem otomatis:

1. Mengecek kuota jalur tujuan (Reguler) — **tetap tunduk pada aturan kuota normal**.
2. **Jika kuota tersedia** (dalam transaction + row lock, sama pola dengan §4):
   - `calon_murid.jalur_asal_id` = id jalur TCP (mencatat asal)
   - `calon_murid.jalur_id` diubah → id jalur Reguler
   - `jalur(Reguler).kuota_terpakai` +1
   - **Langsung dianggap diterima** (tanpa assessment ulang): `pengumuman.status_akhir` = `'diterima'`
   - `calon_murid.status_keseluruhan` = `'diterima'` (lanjut ke tahap Admission Fee)
   - Catat di `audit_log`: aksi `auto_transfer_jalur`
3. **Jika kuota Reguler PENUH** (dikoreksi — bukan langsung "Tidak Diterima"):
   - `calon_murid.status_keseluruhan` = `'menunggu_kuota_fallback'`
   - `calon_murid.menunggu_fallback_jalur_id` = id jalur Reguler
   - `pengumuman.status_akhir` **dibiarkan NULL** (belum diputuskan — bukan "Tidak Diterima")
   - Wali murid melihat status **"Menunggu"**, bukan "Tidak Diterima": *"Pendaftaran Anda sedang menunggu ketersediaan kuota di jalur Reguler. Panitia akan memberi kabar begitu kuota tersedia."*
   - Catat di `audit_log`: aksi `auto_transfer_pending_kuota`
   - Masuk ke **antrian FIFO** (urut berdasarkan `created_at` calon_murid) untuk jalur Reguler tsb.
4. Wali murid yang berhasil pindah (poin 2) **tidak perlu bayar ulang** — pembayaran pendaftaran yang sudah `verified` di jalur TCP tetap berlaku (nominal tidak disesuaikan otomatis ke tarif Reguler; lihat catatan asumsi §5D).

```
Admin tandai "Tidak Diterima" di jalur TCP
            │
            ▼
   jalur.fallback_jalur_id ada? ──NO──► status tetap "Tidak Diterima" (alur normal)
            │YES
            ▼
   Kuota jalur tujuan (Reguler) tersedia?
            │                    │
           YES                   NO
            │                    │
            ▼                    ▼
  Pindahkan jalur_id → Reguler   status_keseluruhan = 'menunggu_kuota_fallback'
  pengumuman.status_akhir        menunggu_fallback_jalur_id = Reguler.id
    → 'diterima'                 pengumuman.status_akhir tetap NULL (belum final)
  status_keseluruhan             masuk antrian FIFO
    → 'diterima'                 Wali murid lihat: "Menunggu kuota tersedia"
  catat audit_log                catat audit_log
            │                    │
            ▼                    ▼
  Lanjut ke Admission Fee    Menunggu admin menambah kuota Reguler (lihat proses antrian di bawah)
```

**Proses ulang antrian saat admin menambah kuota:**

Saat admin menaikkan `kuota_maks` jalur Reguler (`PATCH /api/admin/jalur/:id`), backend otomatis memicu fungsi `reprocessAntrianFallback(jalurRegulerId)`:

```ts
async function reprocessAntrianFallback(jalurId: string) {
  // Ambil antrian FIFO — yang paling dulu menunggu diproses lebih dulu
  const antrian = await supabaseServer
    .from("calon_murid")
    .select("*")
    .eq("menunggu_fallback_jalur_id", jalurId)
    .eq("status_keseluruhan", "menunggu_kuota_fallback")
    .order("created_at", { ascending: true });

  for (const calonMurid of antrian.data ?? []) {
    const berhasil = await tryAutoTransfer(calonMurid, jalurId); // pola sama dengan §5B poin 2, dalam transaction + row lock
    if (!berhasil) break; // kuota habis lagi di tengah proses antrian, sisanya tetap menunggu
  }
}
```

- Dipanggil otomatis setiap kali `kuota_maks` jalur Reguler diperbesar.
- Juga sediakan endpoint manual `POST /api/admin/jalur/:id/proses-ulang-antrian` agar admin bisa memicu ulang kapan saja tanpa harus mengubah angka kuota (mis. setelah ada yang membatalkan pendaftaran di Reguler sehingga `kuota_terpakai` berkurang).
- Admin dapat melihat daftar antrian lewat `GET /api/admin/jalur/:id/antrian-fallback` untuk transparansi (siapa saja yang menunggu, sejak kapan).



### 5C. Auto-Delete Data Calon Murid Saat Gagal (khusus Jalur Reguler & Pindahan)

**Aturan (dikoreksi):** jalur dengan `hapus_data_jika_gagal = true` — diaktifkan di **Jalur Reguler** dan **Jalur Pindahan**. Saat admin menandai **Tidak Diterima** untuk calon murid di salah satu jalur tsb (baik yang daftar langsung maupun yang sampai di situ lewat auto-transfer dari TCP):

→ Sistem menghapus **HANYA data calon_murid (anak) yang gagal itu sendiri**:
- Baris `calon_murid` miliknya.
- Otomatis ikut terhapus lewat cascade FK (`ON DELETE CASCADE` yang sudah ada di skema §3): `form_response`, `pembayaran`, `hasil_assessment`, `pengumuman`, `status_grup_wa` — **hanya milik calon murid ini**.

→ **TIDAK disentuh sama sekali:**
- Row `users` (akun wali murid tetap ada, tetap bisa login).
- **Anak lain di bawah akun yang sama** — termasuk yang sudah **diterima** di jalur/kategori lain, datanya tetap utuh.

Karena skema `form_response`, `pembayaran`, `hasil_assessment`, `pengumuman`, `status_grup_wa` sudah didefinisikan dengan `REFERENCES calon_murid(id) ON DELETE CASCADE` (§3), implementasinya jadi sederhana — cukup satu `DELETE` di tabel `calon_murid`:

```ts
// app/api/admin/peserta/[id]/pengumuman/route.ts (bagian tambahan setelah update status)
async function handleTidakDiterima(calonMurid) {
  const jalur = await getJalur(calonMurid.jalur_id);

  // 5B: cek auto-transfer dulu (khusus jalur yang punya fallback, mis. TCP → Reguler)
  if (jalur.fallback_jalur_id) {
    const transferred = await tryAutoTransfer(calonMurid, jalur.fallback_jalur_id);
    if (transferred) return; // sukses pindah ke jalur fallback, tidak lanjut ke penghapusan
  }

  // 5C: cek auto-delete data calon murid (berlaku untuk jalur Reguler & Pindahan,
  // terlepas dari apakah calon murid daftar langsung atau via transfer)
  if (jalur.hapus_data_jika_gagal) {
    await auditLog({
      action: "auto_delete_calon_murid",
      detail: {
        user_id: calonMurid.user_id,
        calon_murid_id: calonMurid.id,
        nama_anak: calonMurid.nama_anak,
        jalur: jalur.nama,
        alasan: "tidak diterima",
      },
    });
    await supabaseServer.from("calon_murid").delete().eq("id", calonMurid.id);
    // cascade FK otomatis menghapus form_response, pembayaran, hasil_assessment,
    // pengumuman, status_grup_wa milik calon_murid ini saja.
  }
}
```

> ⚠️ **Catatan penting (risiko jauh lebih kecil dari desain sebelumnya, tapi tetap perhatikan):**
> 1. **Data pembayaran calon murid ini ikut terhapus** (karena cascade). Jika pembayarannya sempat `verified`/lunas via Midtrans, menghapus baris `pembayaran` menghilangkan jejak transaksi keuangan tsb dari sistem. **Rekomendasi kami:** untuk baris `pembayaran` saja, pertimbangkan **soft delete** (`deleted_at` + tetap simpan nominal & status transaksi) alih-alih ikut ter-cascade-hapus, khusus demi kebutuhan pembukuan/audit keuangan sekolah — meski data pribadi (nama, jawaban observasi, dsb.) boleh benar-benar dihapus sesuai instruksi. Ini murni saran, silakan dikonfirmasi apakah perlu atau hard delete penuh sudah cukup.
> 2. **Tetap sediakan konfirmasi di UI admin** sebelum eksekusi (mis. "Data pendaftaran [nama anak] akan dihapus permanen. Lanjutkan?") supaya admin sadar aksi ini permanen, walau sekarang cakupannya sudah jauh lebih aman (tidak menyentuh akun/anak lain).
> 3. Snapshot ke `audit_log` **sebelum** delete (sudah tercermin di kode contoh di atas) tetap dipertahankan, supaya ada jejak "anak X dari akun Y pernah mendaftar dan gagal di jalur Z" untuk keperluan laporan meski datanya sendiri sudah tidak ada.

### 5D. Asumsi & Hal yang Perlu Dikonfirmasi ke Sekolah

1. **Selisih biaya TCP vs Reguler saat auto-transfer:** diasumsikan **tidak ada pembayaran tambahan/pengembalian** — wali murid dianggap lunas dengan nominal TCP yang sudah dibayar, walau tarif Reguler mungkin berbeda. Jika sekolah ingin ada penyesuaian (nagih selisih atau refund selisih), perlu modul tambahan.
2. **Jalur Pindahan tidak punya fallback** (`fallback_jalur_id = NULL`) — kegagalan di Pindahan langsung memicu §5C (hapus data calon murid tsb), tidak dialihkan ke jalur lain. Jika ternyata Pindahan yang gagal juga seharusnya bisa dialihkan ke Reguler (seperti TCP), beri tahu kami untuk disamakan.
3. **Assessment untuk kandidat auto-transfer TCP→Reguler:** karena langsung dianggap diterima, kandidat ini **tidak akan muncul di jadwal Assessment jalur Reguler** — pastikan ini sudah sesuai ekspektasi (mis. tidak perlu wawancara ulang sama sekali).
4. ~~Jika TCP gagal tapi kuota Reguler penuh~~ — **sudah dijawab**: calon murid masuk status antrian `menunggu_kuota_fallback`, bukan langsung "Tidak Diterima". Lihat mekanisme lengkap & proses ulang antrian di §5B.





**Scope:** hanya untuk **Pembayaran Pendaftaran**. Pembayaran DU tetap manual (upload bukti + verifikasi admin) — lihat §6.3 dan §8.4 di dokumen PRD/roadmap.

## 6. Integrasi Midtrans Snap (Pembayaran Pendaftaran)

### 6.1 Alur (Sequence)

```
Wali Murid          Next.js API (server)         Midtrans           Supabase DB
    │                       │                        │                   │
    │  klik "Bayar"         │                        │                   │
    ├──────────────────────►│                        │                   │
    │                       │  POST /snap/transactions                   │
    │                       │  (server_key, order_id, gross_amount, ...) │
    │                       ├───────────────────────►│                   │
    │                       │  ◄── snap_token ────────┤                   │
    │                       │  simpan snap_token,       │                 │
    │                       │  order_id, status=pending ├────────────────►│
    │  ◄── snap_token ──────┤                        │                   │
    │  buka popup Snap.js   │                        │                   │
    │  (bayar via VA/QRIS/  │                        │                   │
    │   e-wallet dst.)      │                        │                   │
    ├───────────────────────────────────────────────►│                   │
    │                       │                        │                   │
    │                       │  ◄── webhook notifikasi (server-to-server) ─┤
    │                       │  verifikasi signature key                  │
    │                       │  update status pembayaran                  │
    │                       ├────────────────────────────────────────────►│
    │  ◄── redirect finish, polling status ────────────────────────────────┤
```

Poin penting:
- **Snap token dibuat di server** (memakai `MIDTRANS_SERVER_KEY`), lalu dikirim ke browser untuk memicu popup `snap.pay(token)` di frontend.
- **Status final pembayaran ditentukan oleh webhook** (`Payment Notification`) dari Midtrans, **bukan** dari redirect URL di browser — redirect hanya untuk UX (tampilkan "sedang diproses"), karena browser bisa saja ditutup pengguna sebelum status final.
- Frontend boleh melakukan polling `GET /api/calon-murid/:id/pembayaran` setelah popup ditutup, untuk menampilkan status terbaru tanpa menunggu refresh manual.

### 6.2 Endpoint Baru

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/calon-murid/:id/pembayaran/midtrans/create` | Server membuat transaksi Snap ke Midtrans, simpan `midtrans_order_id` & `snap_token`, kembalikan `snap_token` ke frontend |
| POST | `/api/webhooks/midtrans` | **Endpoint publik** (tanpa auth session, diverifikasi via signature key) — menerima notifikasi status dari Midtrans, update tabel `pembayaran` |
| GET | `/api/calon-murid/:id/pembayaran` | *(sudah ada)* — dipakai frontend untuk polling status setelah popup Snap ditutup |

### 6.3 Contoh Kode — Membuat Transaksi Snap (Server)

```ts
// app/api/calon-murid/[id]/pembayaran/midtrans/create/route.ts
import midtransClient from "midtrans-client";
import { supabaseServer } from "@/lib/supabase-server";

const snap = new midtransClient.Snap({
  isProduction: true, // sesuai key yang dipakai (production)
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const calonMuridId = params.id;

  // 1. Ambil data calon murid + nominal biaya pendaftaran (dari master data/harga)
  const { data: calonMurid } = await supabaseServer
    .from("calon_murid")
    .select("id, nama_anak, user_id, users(email)")
    .eq("id", calonMuridId)
    .single();

  const grossAmount = 500_000; // contoh: ambil dari master data biaya pendaftaran, jangan hardcode di produksi

  // 2. Buat order_id unik & idempotent
  const orderId = `PDF-${calonMuridId.slice(0, 8)}-${Date.now()}`;

  // 3. Request Snap token ke Midtrans
  const transaction = await snap.createTransaction({
    transaction_details: { order_id: orderId, gross_amount: grossAmount },
    customer_details: {
      first_name: calonMurid.nama_anak,
      email: calonMurid.users.email,
    },
    // enabled_payments: ['bank_transfer','qris','gopay', ...] // opsional, batasi metode jika perlu
  });

  // 4. Simpan order_id + snap_token ke tabel pembayaran (status: pending)
  await supabaseServer.from("pembayaran").insert({
    calon_murid_id: calonMuridId,
    jenis: "pendaftaran",
    metode_pembayaran: "midtrans",
    status: "pending",
    midtrans_order_id: orderId,
    midtrans_snap_token: transaction.token,
  });

  return Response.json({ snap_token: transaction.token });
}
```

```html
<!-- Frontend: memuat Snap.js -->
<script
  src="https://app.midtrans.com/snap/snap.js"
  data-client-key="NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_DISINI">
</script>
<script>
  // setelah fetch snap_token dari endpoint create di atas:
  window.snap.pay(snapToken, {
    onSuccess: function(result) { /* tampilkan status "sedang diverifikasi" — status final tetap dari webhook */ },
    onPending: function(result) { /* tampilkan status pending, mis. VA belum dibayar */ },
    onError: function(result) { /* tampilkan pesan gagal, sediakan tombol coba lagi */ },
    onClose: function() { /* popup ditutup tanpa selesai bayar — biarkan status tetap pending */ }
  });
</script>
```

> **Catatan produksi:** URL Snap.js untuk **production** adalah `https://app.midtrans.com/snap/snap.js` — **bukan** `https://app.sandbox.midtrans.com/snap/snap.js` (itu untuk sandbox). Pastikan tidak tertukar karena key yang dipakai sudah production/live.

### 6.4 Contoh Kode — Webhook Handler (Notification)

```ts
// app/api/webhooks/midtrans/route.ts
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const payload = await req.json();
  const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type, transaction_id } = payload;

  // 1. WAJIB: verifikasi signature key sebelum memercayai payload apa pun
  const expectedSignature = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest("hex");

  if (expectedSignature !== signature_key) {
    return new Response("Invalid signature", { status: 403 });
  }

  // 2. Petakan transaction_status Midtrans → status internal
  let statusInternal: "pending" | "verified" | "rejected" = "pending";
  if (["capture", "settlement"].includes(transaction_status)) statusInternal = "verified";
  if (["deny", "cancel", "expire", "failure"].includes(transaction_status)) statusInternal = "rejected";
  // 'pending' (mis. menunggu VA dibayar) → tetap 'pending'

  // 3. Update idempotent berdasarkan order_id (unique)
  await supabaseServer
    .from("pembayaran")
    .update({
      status: statusInternal,
      midtrans_transaction_id: transaction_id,
      midtrans_payment_type: payment_type,
      midtrans_raw_payload: payload,
      verified_at: statusInternal === "verified" ? new Date().toISOString() : null,
    })
    .eq("midtrans_order_id", order_id);

  // 4. Jika verified → trigger perubahan status_keseluruhan calon_murid ke 'enrollment'
  //    (gunakan fungsi/trigger yang sama dengan flow verifikasi manual agar konsisten)

  return new Response("OK", { status: 200 });
}
```

**Checklist keamanan webhook:**
- [ ] Verifikasi `signature_key` di **setiap** request (jangan pernah skip meski untuk testing).
- [ ] Jadikan `midtrans_order_id` sebagai kunci idempotency — jika notifikasi datang dua kali dengan status sama, update tidak boleh menyebabkan efek ganda (mis. kuota bertambah dua kali).
- [ ] Daftarkan URL webhook (`https://spmb.fitrahinsani.sch.id/api/webhooks/midtrans`) di **Midtrans Dashboard → Settings → Configuration → Payment Notification URL**.
- [ ] Endpoint webhook tidak boleh mensyaratkan session login (Midtrans yang memanggil, bukan browser wali murid) — keamanannya murni dari signature key, bukan dari auth Supabase.
- [ ] Karena ini environment **production/live**, lakukan **transaksi uji dengan nominal kecil terlebih dahulu** (atau mekanisme "mode uji" internal, mis. status tes) sebelum dibuka ke wali murid sungguhan, untuk memastikan webhook & update status berjalan benar.

### 6.5 Perubahan pada Flow yang Sudah Ada

- Halaman `/anak/:id/pembayaran-pendaftaran` sekarang menampilkan **dua opsi**: "Bayar via Midtrans" (utama, tombol besar) dan fallback opsional "Upload bukti manual" jika ingin tetap disediakan (opsional — bisa dihilangkan sepenuhnya jika Midtrans sudah dianggap cukup andal).
- Status pembayaran yang berasal dari Midtrans **tidak perlu verifikasi admin** (`verified_by` akan NULL, `verified_at` terisi otomatis dari webhook) — dashboard admin (§7.7 Verifikasi Pembayaran) harus membedakan tampilan "Terverifikasi otomatis (Midtrans)" vs "Diverifikasi manual oleh [nama admin]".
- Pembayaran **DU tetap 100% manual** seperti desain sebelumnya — tidak ada perubahan di modul itu.

## 7. API Endpoints (REST)

### 7.1 Auth
Seluruh endpoint di bawah adalah wrapper tipis di Next.js API Routes yang memanggil **Supabase Auth** (`supabase.auth.signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, dsb.) — bukan implementasi auth manual.

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| POST | `/api/auth/register` | Registrasi akun (email, password) via Supabase Auth | Public |
| POST | `/api/auth/login` | Login via Supabase Auth | Public |
| POST | `/api/auth/logout` | Logout (invalidate session Supabase) | Wali Murid/Admin |
| POST | `/api/auth/forgot-password` | Trigger `resetPasswordForEmail` Supabase | Public |
| POST | `/api/auth/reset-password` | Set password baru | Public |

- Setelah user Supabase Auth dibuat, sistem otomatis membuat baris terkait di tabel `users` (role default `wali_murid`), atau menyinkronkan lewat trigger/Edge Function di Supabase.
- Role `admin` ditandai lewat kolom `role` di tabel `users` (bukan lewat Supabase Auth roles bawaan), dicek di middleware Next.js untuk membatasi akses `/admin/*`.

### 7.2 Wali Murid — Calon Murid (Anak)
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/calon-murid` | List anak milik akun login |
| POST | `/api/calon-murid` | Tambah anak baru (nama_anak) |
| GET | `/api/calon-murid/:id` | Detail anak + status semua tahap |
| PATCH | `/api/calon-murid/:id/jalur` | Pilih/ubah jalur (validasi kuota & status aktif) |
| PATCH | `/api/calon-murid/:id/kategori` | Pilih/ubah kategori + sub_kategori (validasi kuota) |

### 7.3 Wali Murid — Pembayaran
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/calon-murid/:id/pembayaran/midtrans/create` | **(Baru)** Buat transaksi Snap Midtrans (nominal otomatis dari matrix biaya §5A), kembalikan `snap_token` — lihat §6 |
| POST | `/api/calon-murid/:id/pembayaran` | Upload bukti bayar manual (jenis: du — pendaftaran kini via Midtrans) |
| GET | `/api/calon-murid/:id/pembayaran` | Riwayat status pembayaran anak ini (baik manual maupun Midtrans) |

> Endpoint publik `POST /api/webhooks/midtrans` (tanpa auth session) juga ditambahkan — lihat detail lengkap di §6.2–§6.4.

### 7.4 Wali Murid — Enrollment
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/enrollment/fields?form_type=data_pribadi` | Ambil daftar field aktif (+ nilai auto-fill) |
| GET | `/api/calon-murid/:id/enrollment` | Ambil jawaban tersimpan (draft/final) |
| PUT | `/api/calon-murid/:id/enrollment` | Simpan draft/submit final |

### 7.5 Wali Murid — Info Tahap & Status
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/konten-tahap/:tahap` | Ambil konten aktif (assessment/announcement/admission_fee/join_wa) |
| GET | `/api/calon-murid/:id/pengumuman` | Status kelulusan (hanya tampil jika ≥ tanggal_rilis) |
| GET | `/api/calon-murid/:id/status-wa` | Status join grup WA |

### 7.6 Admin — Master Data
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/admin/jalur` | List/buat jalur |
| PATCH | `/api/admin/jalur/:id` | Update (toggle aktif, periode, kuota, **`fallback_jalur_id`**, **`hapus_data_jika_gagal`**). **Menaikkan `kuota_maks` otomatis memicu proses ulang antrian fallback** — lihat §5B |
| GET | `/api/admin/jalur/:id/antrian-fallback` | **(Baru)** List calon murid berstatus `menunggu_kuota_fallback` untuk jalur ini, urut FIFO |
| POST | `/api/admin/jalur/:id/proses-ulang-antrian` | **(Baru)** Trigger manual proses ulang antrian fallback (di luar momen kuota dinaikkan) — lihat §5B |
| GET/POST | `/api/admin/kategori` | List/buat kategori |
| PATCH | `/api/admin/kategori/:id` | Update (toggle aktif, periode, kuota) |
| GET/POST | `/api/admin/biaya-pendaftaran` | **(Baru)** List/tambah nominal per kombinasi jalur×kategori — lihat §5A |
| PATCH | `/api/admin/biaya-pendaftaran/:id` | **(Baru)** Update nominal / status aktif |
| GET/POST | `/api/admin/form-fields` | List/tambah field form builder |
| PATCH/DELETE | `/api/admin/form-fields/:id` | Update/hapus field |
| GET/POST | `/api/admin/konten-tahap` | List/buat konten CMS per tahap |
| PATCH | `/api/admin/konten-tahap/:id` | Update konten |

### 7.7 Admin — Peserta & Verifikasi
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/admin/peserta` | List semua calon murid + filter (jalur, kategori, status) |
| GET | `/api/admin/peserta/:id` | Detail lengkap 1 calon murid |
| PATCH | `/api/admin/pembayaran/:id/verifikasi` | Verifikasi/tolak pembayaran |
| PATCH | `/api/admin/peserta/:id/hasil-assessment` | Input hasil asesmen |
| PATCH | `/api/admin/peserta/:id/pengumuman` | Input status diterima/tidak (satu-satu). **Jika "Tidak Diterima" memicu aturan §5B (auto-transfer) atau §5C (auto-delete) — respons endpoint harus mengembalikan info efek samping yang terjadi, agar UI admin bisa menampilkan konfirmasi/notifikasi yang jelas** |
| PATCH | `/api/admin/peserta/:id/status-wa` | Update status join grup WA |
| GET | `/api/admin/laporan/export` | Export rekap ke Excel/CSV (query param: filter) |

## 8. Halaman / Routing Map

**Wali Murid**
```
/register
/login
/forgot-password
/dashboard                        → daftar anak
/anak/tambah                      → step 1: pilih jalur
/anak/:id/kategori                → step 2: pilih kategori
/anak/:id/pembayaran-pendaftaran  → upload bukti bayar
/anak/:id/enrollment/data-pribadi
/anak/:id/enrollment/observasi
/anak/:id/assessment
/anak/:id/pengumuman              → juga menampilkan status "Menunggu Kuota" jika status_keseluruhan = 'menunggu_kuota_fallback' (§5B)
/anak/:id/admission-fee
/anak/:id/join-wa
```

**Admin**
```
/admin/login
/admin/dashboard                  → list semua peserta + filter
/admin/peserta/:id                → detail peserta (tab: profil, observasi, pembayaran)
/admin/jalur                      → kelola jalur (toggle, kuota, periode)
/admin/kategori                   → kelola kategori (toggle, kuota, periode)
/admin/form-builder               → kelola field data pribadi & observasi
/admin/konten/assessment
/admin/konten/announcement
/admin/konten/admission-fee
/admin/konten/join-wa
/admin/laporan                    → export Excel
```

## 9. Validasi Kunci

- **No. WA (Indonesia):** regex `^(\+62|62|0)8[1-9][0-9]{6,10}$` (disesuaikan standar operator terbaru saat implementasi).
- **Email:** RFC-compliant email validation standar.
- **Urutan status calon_murid:** backend menolak akses ke endpoint tahap berikutnya bila status belum memenuhi syarat (mis. tidak bisa akses `/enrollment` sebelum `pembayaran.status = verified`).
- **Kuota:** validasi dilakukan di backend (bukan hanya UI) agar tidak bisa dilewati lewat request langsung ke API.

## 10. Kebutuhan Non-Fungsional (turunan dari PRD §10)

- File upload bukti pembayaran: maks 5MB, format jpg/png/pdf, disimpan di **Supabase Storage** bucket privat (`bukti-pembayaran`); akses file hanya lewat signed URL yang di-generate backend, bukan bucket publik.
- Konten CMS (gambar Announcement/Assessment dsb.) disimpan di bucket terpisah (`konten-cms`), boleh publik karena memang untuk ditampilkan ke semua wali murid.
- Semua perubahan status oleh admin dicatat di tabel log audit terpisah (`audit_log`: actor_id, action, entity, entity_id, timestamp, detail) — direkomendasikan ditambahkan sebagai tabel tambahan saat implementasi.
- Rate limiting pada endpoint auth (login/register) untuk mencegah brute force — Supabase Auth sudah menyediakan rate limit dasar, tetap tambahkan proteksi di level Next.js API Route untuk endpoint sensitif lain.
- **Koneksi database:** gunakan Supabase connection pooling (PgBouncer, mode transaksi) saat traffic tinggi dari Vercel serverless functions, agar tidak menghabiskan connection limit Postgres.
- **Environment terpisah:** disarankan minimal 2 project Supabase (staging & production) yang keduanya terhubung ke deployment Vercel berbeda (preview vs production).
- **Midtrans production key:** `MIDTRANS_SERVER_KEY` diperlakukan sebagai secret paling sensitif di sistem (setara kredensial bank) — jangan pernah log ke console/Vercel logs, jangan commit ke Git, rotasi key jika pernah ter-expose. Karena key ini **production/live**, setiap transaksi uji coba akan memotong saldo/rekening sungguhan — koordinasikan dengan bendahara sebelum melakukan uji end-to-end.
- **Auto-delete data calon murid (§5C):** wajib ada dialog konfirmasi eksplisit di UI admin sebelum eksekusi, snapshot data ke `audit_log` sebelum dihapus. Cakupan hapus sudah dibatasi hanya ke calon murid yang gagal (bukan seluruh akun) berkat FK `ON DELETE CASCADE` di §3 — pertimbangkan tetap soft-delete khusus baris `pembayaran` untuk kebutuhan audit keuangan, lihat catatan di §5C.

---

*Dokumen ini melengkapi PRD v3 dan menjadi acuan tim development untuk implementasi database, API, dan struktur halaman. Bagian §5 (biaya dinamis, auto-transfer, auto-delete) adalah penambahan terbaru — mohon direview bersama pihak sekolah sebelum dikerjakan, khususnya poin peringatan di §5C dan asumsi di §5D.*
