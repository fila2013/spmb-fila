# Project Status — SPMB Fila

**Tanggal snapshot:** 7 September 2026  
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
| Auth | Register/login, konfirmasi email dua langkah, reset password, cookie session, profile aktif, role admin/wali dan ownership |
| Master data | Jalur/kategori, periode/keaktifan, kuota, matrix biaya Jalur × Kategori |
| Pendaftaran | Satu akun banyak anak, pemilihan jalur/kategori dan alokasi kuota atomik |
| Pembayaran pendaftaran | Snap token server-side, webhook signature/merchant/nominal, idempotency dan retry; mode transfer manual, rekening sekolah, preview/penghapusan bukti |
| Enrollment | Form builder sederhana, draft Data Pribadi/Observasi, validasi final dan gate payment verified |
| CMS dan tahap | Beranda, gambar/YouTube, konten assessment/pengumuman/DU/WA, tanggal rilis dan tombol Google Calendar |
| Hasil seleksi | Input assessment/pengumuman admin, TCP gagal ke Reguler, FIFO ketika penuh, reprocess otomatis/manual |
| Pilihan kelas final | Fitur opsional per jalur TCP diterima; pilihan sekali sebelum DU, pelepasan kuota TCP dan antrean Reguler bila penuh |
| Penghapusan | Auto-delete anak gagal dengan konfirmasi/snapshot, penghapusan peserta manual dan akun wali tanpa anak, retention ledger |
| DU dan WhatsApp | Upload bukti DU, preview/verifikasi admin dengan nominal aktual, link grup per peserta, konfirmasi wali sampai selesai |
| Reporting | Filter peserta, ekspor CSV/XLSX, sanitasi formula dan audit ekspor |
| Pengujian | Unit test, integration staging per domain dan smoke E2E Chromium mobile |

## In-progress features / pekerjaan aktif

Fresh setup pada checkout baru sudah diselesaikan 7 September 2026. Instalasi
menemukan bahwa `npm run typecheck` gagal pada checkout tanpa `.next` karena helper
global `LayoutProps` belum dihasilkan. Script `typecheck` kini menjalankan
`next typegen` sebelum `tsc --noEmit`, sesuai panduan lokal Next.js 16.

- Fresh `npm ci` dan postinstall Prisma generate berhasil.
- Lint, typecheck, 29 file / 132 unit test, dan build dengan `.env.example` lulus.
- `.env.local` staging belum tersedia; migration status, Integration/E2E, Storage,
  Auth, Midtrans Sandbox, dan layanan remote belum diverifikasi.
- Validasi Phase 12 Production tetap pekerjaan lanjutan; tidak ada bukti deployment
  sedang berjalan atau sudah selesai.

Jangan menandai fitur sebagai in-progress hanya karena sudah tercantum dalam
roadmap. Periksa perubahan terbaru di Git dan instruksi pengguna saat melanjutkan.

## Pending features / pekerjaan yang belum selesai

### Untuk kesiapan MVP dan production

- Verifikasi migration yang benar-benar diterapkan pada staging, terutama dua
  migration pilihan kelas final TCP tanggal 5 September 2026.
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
| Verifier migration belum mencakup dua migration TCP terbaru | `prisma/verify-migration.mjs` | Hasil verifier tidak membuktikan semua migration terpasang; cek `migrate status` dan integration final-route-choice. Verifier membuat schema/fixture sementara lalu rollback. |
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

Pemeriksaan berikut dijalankan pada fresh checkout 7 September 2026:

| Pemeriksaan | Hasil |
|---|---|
| ESLint melalui CLI dependency | Lulus |
| TypeScript `--noEmit` | Lulus |
| Vitest | 29 file, 132 test lulus |
| Next.js production build | Lulus dengan nilai dummy `.env.example`; tidak membuktikan koneksi layanan |
| Fresh `npm ci` / postinstall generate | Lulus, 653 package dan Prisma Client 7.10.0 |
| Integration/E2E staging | Belum dijalankan; `.env.local` staging tidak tersedia |
| Migration remote / deployment / transaksi live | Belum dijalankan atau diverifikasi |

Launcher npm global lokal masih bermasalah, sehingga setup menggunakan
`corepack npm@11.12.1`. `npm run check` tanpa `.env.local` mencapai build lalu
berhenti pada validasi `DATABASE_URL`/`DIRECT_URL`; build terpisah dengan nilai
dummy `.env.example` lulus. Hasil ini bukan klaim quality gate Phase 11 staging.

## Pekerjaan terakhir dan titik lanjut untuk komputer lain

### Snapshot Git saat pekerjaan dilanjutkan

- HEAD: `450ef65` — `docs: update project handover context`.
- Commit source terakhir: `22199cd` — `fix: allow released TCP quota queue state`.
- Commit sebelumnya: `ea9a128` — `feat: add final TCP route choice`.
- Sebelumnya lagi: `42df40e` — `fix: route password recovery to reset form`.
- Migration terakhir: `20260905100000_allow_released_tcp_queue`, mengikuti
  `20260905090000_tcp_final_route_choice`.
- Working tree berisi perbaikan script `typecheck` di `package.json` dan pembaruan
  hasil verifikasi pada dokumentasi; perubahan ini belum di-commit/push.
- Source domain aplikasi, schema dan migration tidak diubah.

Clone/pull di komputer lain hanya membawa perubahan yang sudah dipublikasikan
ke remote. Pastikan ketiga dokumen dipindahkan melalui commit/push yang disepakati
atau transfer file sebelum memakai snapshot ini. Jangan menyalin `.env.local`
ke Git; isi credential melalui saluran aman. Tidak perlu memindahkan `node_modules`,
`.next` atau `generated/prisma`; hasilkan ulang dari dependency project.

### Urutan melanjutkan

1. Baca AGENTS, README, dokumen ini dan Final Decisions; periksa `git status`
   serta `git log` agar snapshot tidak menimpa pekerjaan yang lebih baru.
2. Ikuti README untuk membuat `.env.local` menggunakan credential staging melalui
   saluran aman. Jangan menampilkan secret di log.
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
5. Catat hasil/failure yang benar-benar direproduksi. Prioritaskan final route
   choice: pilih sekali, lepas kuota TCP, antre Reguler penuh, reprocess FIFO dan
   gate DU. Lanjutkan perbaikan kode hanya dalam task implementasi yang diotorisasi.
6. Selesaikan konfigurasi panitia dan validasi Phase 12. Perbarui snapshot ini
   dengan tanggal, commit, hasil test dan next task setelah setiap milestone.

### Konteks singkat yang dapat diberikan ke Codex berikutnya

> Lanjutkan SPMB Fila dari PROJECT_STATUS.md. Fresh setup dan gate lokal sudah
> dijalankan; script typecheck diperbaiki agar menghasilkan route types Next.js.
> Berikutnya siapkan `.env.local` staging melalui saluran aman, verifikasi migration,
> lalu jalankan quality gate staging terutama pilihan kelas final TCP serta FIFO.
> Jangan menganggap deployment/migration production sudah terverifikasi. Baca Final
> Decisions dan laporkan temuan aktual sebelum memperluas scope implementasi.

## Aturan yang tidak boleh hilang saat handoff

- Nominal pendaftaran dari matrix database; upload manual valid maksimal 500 KB
  langsung verified. DU maksimal 5 MB tetap perlu verifikasi/nominal aktual admin.
- Final pembayaran Midtrans dari webhook tervalidasi dan idempotent, bukan callback.
- Session, role, ownership dan gate tahap divalidasi server-side.
- Kuota, fallback FIFO dan pilihan final harus atomik; Reguler penuh berarti
  menunggu kuota, bukan langsung tidak diterima.
- Auto-delete anak gagal tidak menghapus wali/anak lain; ledger pembayaran tetap.
- Jangan mengarang requirement, membuka secret atau menjalankan fixture pada
  production. Pending task tidak berarti deployment, migration remote atau
  perubahan source yang berbeda sudah diotorisasi.
