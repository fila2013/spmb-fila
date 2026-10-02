# Project Status — SPMB Fila

**Tanggal snapshot:** 2 Oktober 2026
**Project:** Sistem Penerimaan Murid Baru SDIT Fitrah Insani Langkapura  
**Tujuan:** serah terima konteks dan pekerjaan berikutnya untuk Codex di komputer lain.

## Kondisi project saat ini

Aplikasi menggunakan Next.js 16.3.3 App Router, React 19.2.8, TypeScript strict,
Tailwind CSS 4, Prisma 7.10.0 dengan adapter-pg, serta Supabase PostgreSQL,
Auth dan Storage. Frontend dan backend berada dalam satu aplikasi Next.js.
Target hosting adalah Vercel; pembayaran pendaftaran mendukung Midtrans Snap
dan transfer manual, sedangkan daftar ulang (DU) tetap manual.

Implementasi cakupan Phase 0–11 beserta suite test tersedia di repository.
**Kesiapan production belum dinyatakan terverifikasi.** Audit terakhir memeriksa
repository dan menjalankan pemeriksaan lokal; tidak memeriksa dashboard layanan,
database staging/production, SMTP atau merchant live.

Baca dokumen berikut sebelum melanjutkan:

1. [AGENTS.md](AGENTS.md): arsitektur, struktur folder dan aturan kerja/domain.
2. [README.md](README.md): setup komputer baru, environment, database dan deployment.
3. [SPMB-FILA-SPEC.md](docs/SPMB-FILA-SPEC.md), terutama **Final Decisions**:
   sumber keputusan bisnis ketika dokumen lama berbeda.
4. [Test matrix](docs/PHASE11_TEST_MATRIX.md) dan
   [Midtrans checklist](docs/MIDTRANS_SANDBOX_CHECKLIST.md).

## Completed features — tersedia dalam implementasi

Status ini berarti kode tersedia, bukan seluruh fitur telah diuji ulang terhadap
layanan remote atau sudah beroperasi di production.

| Area | Cakupan yang sudah diimplementasikan |
|---|---|
| Fondasi database | Schema dan migration incremental, RLS, constraint kuota/status, trigger sinkronisasi profile Supabase Auth, audit log dan retention pembayaran |
| Auth | Register/login, konfirmasi email dua langkah, resend verifikasi, profile pending sampai email terkonfirmasi, reset password, cookie session, role admin/wali dan ownership |
| Master data | Jalur/kategori, periode/keaktifan, kuota, matrix biaya Jalur × Kategori |
| Pendaftaran | Satu akun banyak anak; pemilihan jalur tanpa pemakaian kuota permanen; hold jalur/kategori atomik dengan expiry configurable dan proteksi kursi terakhir |
| Pembayaran pendaftaran | Snap token server-side dengan expiry selaras hold, webhook signature/merchant/nominal, idempotency dan retry; upload transfer manual langsung verified; promosi hold/counter hanya saat verified |
| Enrollment | Form builder sederhana, draft Data Pribadi/Observasi, validasi final, gate payment verified, unduh PDF A4, dan QR chat WhatsApp Ayah/Bunda pada detail peserta admin |
| CMS dan tahap | Beranda, gambar/YouTube, konten assessment/pengumuman/DU/WA, rentang urutan peserta per jalur/kategori untuk empat tahap wali, tanggal rilis dan tombol Google Calendar |
| Hasil seleksi | Input assessment/pengumuman admin di halaman detail dan modal edit cepat dari badge status daftar peserta, TCP gagal ke Reguler, FIFO ketika penuh, reprocess otomatis/manual |
| Pilihan kelas final | Fitur opsional per jalur diterima dengan target pilihan final terpisah dari fallback gagal; pilihan sekali sebelum DU, pelepasan kuota asal dan antrean target bila penuh |
| Penghapusan | Auto-delete anak gagal dengan konfirmasi/snapshot, penghapusan peserta manual dan akun wali tanpa anak, retention ledger |
| DU dan WhatsApp | Upload bukti DU, preview/verifikasi admin dengan nominal aktual, link grup per peserta, konfirmasi wali sampai selesai |
| Reporting | Filter peserta, ekspor CSV/XLSX, sanitasi formula dan audit ekspor |
| Pengujian | Unit test, integration staging per domain dan smoke E2E Chromium mobile |

## In-progress features / pekerjaan aktif

Pemisahan Tempat/Tanggal lahir dan aturan usia bulanan pada Form Builder serta
validasi sebelum pembayaran diimplementasikan di source 2 Oktober 2026.
Migration `20261002090000_enrollment_birth_date_age_rule` mengarsipkan field
gabungan tanpa menghapus jawaban historis, lalu membuat field Tempat/Tanggal
lahir. Migration `20261002100000_calon_murid_birth_before_payment` menambah
kolom nullable pada peserta dan menghubungkan auto-fill kedua field. Keduanya
diterapkan ke database yang ditunjuk `.env.local`; `migrate status` menunjukkan
21 migration up to date. Percobaan awal migration kedua gagal karena constraint
auto-fill lama, seluruh transaksinya rollback; setelah constraint diperluas,
migration di-resolve sebagai rolled-back dan diterapkan ulang dengan sukses.
Pemeriksaan read-only pascamigrasi: 79 peserta historis tetap ada, semua kolom
lahir barunya NULL, dan aturan tanggal aktif adalah minimal 6 tahun per Juli
2027. Pendaftaran baru meminta tempat/tanggal lahir sejak langkah pertama;
server memeriksa usia sebelum data anak dibuat, sebelum hold kategori, dan
sebelum transaksi/unggah bukti pembayaran. Peserta lama yang belum membayar
dapat melengkapi data lahir di tahap kategori. Enrollment peserta baru
terisi otomatis dan mengunci data lahir dari pendaftaran awal; peserta lama
tetap dapat mengisi field baru dengan jawaban gabungan sebagai rujukan.
Panel "Aturan usia sebelum pembayaran" kini tampil langsung di bagian atas
Form Builder dan mengubah tiga nilai pada field Tanggal lahir yang sama; tidak
ada tabel atau migrasi baru. Perhitungan memakai tahun lahir batas
(`tahun acuan - usia minimal`), lalu membandingkan bulan bila tahun lahir sama.
Input tanggal pada halaman wali menampilkan ulang pilihan sebagai nama bulan
Indonesia agar format angka tidak ambigu. Matrix aturan dinamis dan pesan
penolakan diuji untuk beberapa kombinasi tahun/bulan; 39 file/192 unit test,
lint, typecheck, dan build lokal lulus. Target database
tidak dibuktikan sebagai staging; integration/E2E yang menulis fixture dan
verifikasi deployment aplikasi belum dijalankan.

Modal edit cepat Assessment/Pengumuman pada `/admin/peserta` ditambahkan
2 Oktober 2026. Badge status membuka form yang sama dengan halaman detail;
Server Action tetap memvalidasi admin, tahap, konfirmasi auto-delete, dan
transisi melalui service existing. Hasil simpan memperbarui baris/filter lokal
lalu menyegarkan data server tanpa navigasi. Halaman detail tetap tersedia.
Tidak ada perubahan schema/migration. Lint, typecheck, 38 file/175 unit test,
dan build lokal lulus; interaksi browser dengan akun admin belum diuji.

Rentang urutan peserta untuk konten Assessment, Announcement, Daftar Ulang,
dan Join WhatsApp diimplementasikan 1 Oktober 2026. Batas kosong tetap tanpa
batas; urutan dihitung dari peserta yang masih ada per jalur/kategori berdasarkan
`created_at ASC, id ASC`, sehingga penghapusan/perpindahan jalur dapat menggeser
nomor berikutnya. Migration nullable `20261001090000_stage_content_participant_order_range`
diterapkan ke database `.env.local`: Prisma menunjukkan 19 migration up to date,
jumlah blok existing tetap 6 dan seluruh batas barunya `NULL`. Verifikasi
deployment aplikasi tetap terpisah dari hasil migrasi ini.

QR chat WhatsApp wali diperbarui pada 30 September 2026. Kartu
No. WA Ayah/Bunda di detail enrollment admin menampilkan QR berisi URL `wa.me`
dengan nomor `62...` tanpa pemisah dan pesan pembuka berisi nama anak. Pesan
di-URL-encode; QR hanya tersedia bila nomor dan nama anak valid. Belum ada
verifikasi scan menggunakan perangkat fisik atau deployment fitur ini.
Daftar peserta admin juga menampilkan timestamp pembuatan data anak di bawah
email, diformat dengan zona waktu Asia/Jakarta; tidak ada perubahan database.

Timeout login lokal ditangani 29 September 2026: profil yang sudah sinkron
dibaca tanpa transaksi, sedangkan pembuatan/perubahan profil memakai upsert SQL
atomik. Koneksi pooled terbukti dapat dijangkau, namun waktu koneksi awal sekitar
2,2 detik melewati batas tunggu transaksi interaktif Prisma 2 detik. Bentuk SQL
upsert diverifikasi dengan `EXPLAIN` tanpa menulis data; login memakai akun
pengguna belum diuji langsung. Perubahan ini belum diverifikasi di deployment.

Sinkronisasi verifikasi email diimplementasikan 26 September 2026:

- Profile baru disimpan nonaktif dengan label `Menunggu Verifikasi Email` sampai
  `email_confirmed_at` Supabase terisi; constraint database mencegah akun
  unverified menjadi aktif.
- Halaman `/resend-confirmation` tersedia dari login untuk meminta tautan baru
  dengan respons generik yang tidak membocorkan keberadaan akun.
- Daftar wali admin default hanya menampilkan akun aktif, menampilkan ringkasan
  jumlah total/aktif/tidak aktif, serta menyediakan filter aktif, tidak aktif,
  menunggu verifikasi, dinonaktifkan, dan semua status.
- Migration `20260926090000_email_verification_status` diterapkan ke database
  `.env.local`. Seluruh 13 akun unverified/0 anak menjadi pending/nonaktif tanpa
  dihapus; tidak ada profile confirmed yang kehilangan timestamp verifikasi.
- Integration Auth membuktikan login ditolak sebelum konfirmasi, konfirmasi
  mengaktifkan profile, login sesudahnya berhasil, dan fixture dibersihkan.

Refactor pilihan jalur final diimplementasikan pada source 24 September 2026:

- Fallback peserta gagal dan target pilihan final peserta diterima kini memakai
  konfigurasi terpisah. Toggle pilihan final tidak lagi bergantung pada fallback.
- Auto-delete peserta gagal dapat digunakan tanpa fallback. Konfirmasi admin dan
  audit snapshot tetap dipertahankan sebelum penghapusan dijalankan.
- Migration baru `20260924090000_decouple_final_route_choice` menambah target
  pilihan final, memigrasikan konfigurasi aktif lama dari fallback, lalu melepas
  constraint ketergantungan lama. Migration ini diterapkan pada 24 September 2026
  ke database yang dikonfigurasi `.env.local`; Prisma menunjukkan seluruh 17
  migration sudah diterapkan.
- Lint, typecheck, 31 file / 146 unit test, Prisma validate, Prisma generate, dan
  Next.js production build lulus. Integration/E2E database belum dijalankan.

Regulasi temporary hold kuota diimplementasikan 22 September 2026:

- Migration baru `20260922090000_registration_quota_holds` menambah ledger hold,
  status `pending_payment/verified/expired/cancelled`, dan durasi default 1440 menit.
- Counter `kuota_terpakai` sekarang hanya permanen setelah pembayaran pendaftaran
  `VERIFIED`; hold aktif dihitung terpisah dan hold expired langsung diabaikan.
- Settlement/capture Midtrans dan upload manual valid mempromosikan hold secara
  atomik; expire/cancel serta cron melepaskannya. Countdown dan pesan kursi terakhir
  tersedia di UI, durasi dapat diubah Admin.
- Vercel Cron harian dan endpoint Bearer `CRON_SECRET` tersedia untuk cleanup.
  Secret lokal terdeteksi valid pada 22 September 2026; konfigurasi Vercel
  dinyatakan sudah diisi oleh pemilik project, tetapi belum dapat dibaca dari
  checkout lokal yang tidak terhubung ke project Vercel CLI.
- Migration `20260922090000_registration_quota_holds` diterapkan ke database
  Supabase yang dikonfigurasi di `.env.local` pada 22 September 2026. Pemeriksaan
  sesudah deploy menunjukkan 16 migration up to date, 3 hold pending, 52 hold
  verified, nol mismatch counter jalur/kategori, dan kedua constraint baru aktif.
- Lint, typecheck, 30 file / 140 unit test, Prisma validate, dan build lulus.
  Smoke endpoint cron lokal juga lulus: request tanpa secret ditolak `401`,
  sedangkan Bearer secret yang valid menerima `200` dan cleanup sukses.
  Integration/E2E staging belum dijalankan karena target `.env.local` masih tidak
  memiliki penanda staging eksplisit sehingga tidak aman menerima fixture.
- Validasi Phase 12 Production dan deployment aplikasi Vercel tetap pekerjaan
  lanjutan; penerapan migration database tidak membuktikan build sudah terdeploy.

Jangan menandai fitur sebagai in-progress hanya karena sudah tercantum dalam
roadmap. Periksa perubahan terbaru di Git dan instruksi pengguna saat melanjutkan.

## Pending features / pekerjaan yang belum selesai

### Untuk kesiapan MVP dan production

- Verifikasi bahwa target Supabase/Vercel yang digunakan memang environment yang
  dimaksud; migration hold sudah diterapkan pada database dari `.env.local`.
- Jalankan ulang quality gate staging lengkap, termasuk dynamic payment,
  final-route-choice, admin-deletion dan E2E.
- Finalisasi pertanyaan Observasi 3–10 bersama panitia; lengkapi kuota/periode,
  matrix biaya, rekening dan konten operasional. Keadaan data remote belum diaudit.
- Verifikasi pemisahan Supabase/Vercel staging dan production, Auth/SMTP,
  bucket, domain, merchant live dan webhook HTTPS.
- Koordinasikan final smoke test production dengan sekolah setelah gate terpenuhi.

### Phase 2 — sengaja ditunda

Notifikasi otomatis, WhatsApp API, role Bendahara/Asesor, Midtrans DU, analytics,
bulk import, multi-tenant, promo dan advanced form builder. Jangan memulai fitur
tersebut sebelum MVP selesai atau tanpa perubahan scope dari pengguna.

## Known bugs, celah verifikasi dan batasan

| Temuan | Bukti/lokasi | Dampak dan tindak lanjut |
|---|---|---|
| Guard Midtrans menerima production saat `VERCEL_ENV` tidak ada | `lib/env/schema.ts` | Potensi salah konfigurasi lokal; selalu gunakan `MIDTRANS_IS_PRODUCTION=false` untuk lokal/staging. Tinjau guard dan tambah regression test dalam task kode tersendiri. |
| Prisma CLI tidak otomatis membaca `.env.local` | `prisma.config.ts` menggunakan `dotenv/config` | Command migration dapat kehilangan `DIRECT_URL`; muat environment eksplisit sesuai README. Ini perbedaan konfigurasi, bukan bukti database rusak. |
| Verifier migration belum mencakup migration pilihan final tanggal 5 dan 24 September | `prisma/verify-migration.mjs` | Verifier kini mencakup hold kuota, tetapi belum membuktikan pilihan final maupun pemisahan targetnya; cek `migrate status` dan integration final-route-choice. Verifier membuat schema/fixture sementara lalu rollback. |
| Target `.env.local` belum dapat dibuktikan staging | Pemeriksaan indikator environment 22 September 2026 | `CRON_SECRET` lokal sudah valid, tetapi Integration/E2E sengaja tidak dijalankan agar fixture tidak berisiko menyentuh production; beri penanda staging eksplisit sebelum gate remote. |
| Observasi 3–10 masih placeholder pada seed | `prisma/seed.ts` | Konten perlu diselesaikan panitia; jangan mengarang pertanyaan bisnis. Seed ulang juga dapat memperbarui properti field dan flag jalur existing. |
| Penghapusan Auth dan DB bukan satu transaksi atomik | `lib/admin-deletion/service.ts` | Jika Supabase Auth gagal, akun tetap nonaktif dan penghapusan dapat dicoba ulang. Ini jalur pemulihan yang diimplementasikan, bukan bukti kegagalan yang terjadi di production. |
| Launcher npm pada komputer audit rusak | `npm --version` gagal menemukan npm CLI global | Masalah instalasi/PATH lokal; tidak otomatis berlaku pada komputer lain. Pastikan npm bekerja sebelum fresh setup. |
| Audit npm menemukan advisory `mysql2` transitif Prisma CLI | `prisma@7.10.0` development dependency membawa `mysql2@3.15.3` | Aplikasi memakai PostgreSQL/`pg`, bukan MySQL. Saran otomatis adalah downgrade major Prisma 6; jangan force-fix. Tinjau pembaruan upstream sebagai task dependency terpisah. |
| Coverage browser masih smoke subset | `e2e/mvp-critical.spec.ts` | Jangan menyamakan E2E yang tersedia dengan seluruh perjalanan browser sampai selesai. |
| Dokumen checklist lama belum sepenuhnya sinkron | `docs/` dibanding Final Decisions | Ikuti specification terbaru; jangan mengandalkan klaim historis migration/deployment tanpa bukti remote. |

Tidak ada bug runtime tambahan yang direproduksi melalui layanan remote pada
audit ini. Daftar ini membedakan temuan kode/config, konten belum final, dan
batas verifikasi agar tidak dianggap semuanya insiden production.

## Hasil verifikasi terakhir

Pemeriksaan kode dan migration terbaru dijalankan 1 Oktober 2026; Auth
integration terakhir dijalankan 26 September. Pemeriksaan database/cron
untuk hold tetap merupakan hasil 22 September:

| Pemeriksaan | Hasil |
|---|---|
| ESLint melalui CLI dependency | Lulus |
| TypeScript `--noEmit` | Lulus |
| Vitest | 37 file, 171 test lulus |
| Prisma schema validate | Lulus pada 1 Oktober 2026 |
| Next.js production build | Lulus dengan `.env.local`; route cron ikut terbangun |
| Smoke cron lokal | Lulus; unauthorized `401`, authorized `200`, tidak ada hold expired saat pemeriksaan |
| Fresh `npm ci` / postinstall generate | Hasil audit 7 September tetap lulus, 653 package dan Prisma Client 7.10.0 |
| Integration/E2E staging | Integration Auth terarah lulus dan fixture dibersihkan; suite integration lain/E2E tidak dijalankan ulang |
| Migration database terkonfigurasi | Lulus; migration rentang urutan peserta diterapkan 1 Oktober dan seluruh 19 migration up to date. Enam blok lama tetap ada dan batasnya `NULL`. Pemeriksaan counter/constraint hold berasal dari 22 September. |
| Deployment aplikasi / transaksi live | Belum diverifikasi dari checkout lokal |

Launcher npm global lokal masih bermasalah, sehingga setup menggunakan
`corepack npm@11.12.1`. `npm run check` tanpa `.env.local` mencapai build lalu
berhenti pada validasi `DATABASE_URL`/`DIRECT_URL`; build terpisah dengan nilai
dummy `.env.example` lulus. Hasil ini bukan klaim quality gate Phase 11 staging.

## Pekerjaan terakhir dan titik lanjut untuk komputer lain

### Snapshot Git saat pekerjaan dilanjutkan

- Basis sebelum implementasi verifikasi email: `d2ac738` —
  `fix: tombol dropdown bug`.
- Commit sebelumnya: `310bcc8` —
  `refactor: decouple final route choice from fallback`.
- Migration `20260922090000_registration_quota_holds` sudah diterapkan ke database
  yang dikonfigurasi `.env.local`. Migration source terbaru
  `20260926090000_email_verification_status` diterapkan pada 26 September 2026.
- Snapshot ini mencakup implementasi status verifikasi email, resend, ringkasan
  dan filter wali admin, test, migration, serta dokumentasi terkait.

Clone/pull di komputer lain hanya membawa perubahan yang sudah dipublikasikan
ke remote. Pastikan ketiga dokumen dipindahkan melalui commit/push yang disepakati
atau transfer file sebelum memakai snapshot ini. Jangan menyalin `.env.local`
ke Git; isi credential melalui saluran aman. Tidak perlu memindahkan `node_modules`,
`.next` atau `generated/prisma`; hasilkan ulang dari dependency project.

### Urutan melanjutkan

1. Baca AGENTS, README, dokumen ini dan Final Decisions; periksa `git status`
   serta `git log` agar snapshot tidak menimpa pekerjaan yang lebih baru.
2. Pastikan `.env.local` benar-benar menunjuk staging melalui penanda/config tim.
   `CRON_SECRET` sudah terisi; jangan menampilkan nilainya.
3. Pastikan kedua URL database menunjuk staging yang sama, lalu periksa status:

   ```bash
   node --env-file=.env.local node_modules/prisma/build/index.js migrate status
   ```

   Bila ada migration tertunda, review SQL/dampaknya dan terapkan pada staging
   dalam scope pekerjaan database yang disepakati. Jangan reset, mengedit migration
   existing atau seed ulang data yang telah dikustomisasi tanpa meninjau dampak.
4. Pastikan Auth/Storage/Sandbox staging siap dan port 3000 tidak memakai server
   dengan environment lain. Install Chromium lalu jalankan quality gate:

   ```bash
   npm run test:e2e:install
   npm run test:phase11
   ```

   Suite ini menulis fixture staging dan meminta transaksi Snap Sandbox.
   Guard Sandbox tidak membuktikan URL Supabase adalah staging; cek target juga.
5. Catat hasil/failure yang benar-benar direproduksi. Prioritaskan race kursi
   terakhir, promosi Midtrans/manual, expire + retry, endpoint cron, lalu regresi
   final route choice/FIFO dan gate DU.
6. Selesaikan konfigurasi panitia dan validasi Phase 12. Perbarui snapshot ini
   dengan tanggal, commit, hasil test dan next task setelah setiap milestone.

### Konteks singkat yang dapat diberikan ke Codex berikutnya

> Lanjutkan SPMB Fila dari PROJECT_STATUS.md. Regulasi temporary hold kuota sudah
> diimplementasikan dan gate lokal lulus. Berikutnya buktikan `.env.local` adalah
> staging, pastikan konfigurasi `CRON_SECRET`, lalu jalankan
> quality gate staging terutama race hold, webhook/upload, expiry/cron, pilihan
> final TCP dan FIFO. Jangan menganggap deployment production sudah terverifikasi.

## Aturan yang tidak boleh hilang saat handoff

- Nominal pendaftaran dari matrix database; upload manual valid maksimal 500 KB
  sebelum expiry langsung verified. DU maksimal 5 MB tetap perlu verifikasi/nominal
  aktual admin.
- Final pembayaran Midtrans dari webhook tervalidasi dan idempotent, bukan callback.
- Session, role, ownership dan gate tahap divalidasi server-side.
- Kuota permanen hanya bertambah saat pembayaran verified; pending menggunakan hold
  expiry terpisah. Kuota, fallback FIFO dan pilihan final harus atomik; Reguler
  penuh berarti menunggu kuota, bukan langsung tidak diterima.
- Auto-delete anak gagal tidak menghapus wali/anak lain; ledger pembayaran tetap.
- Jangan mengarang requirement, membuka secret atau menjalankan fixture pada
  production. Pending task tidak berarti deployment, migration remote atau
  perubahan source yang berbeda sudah diotorisasi.
