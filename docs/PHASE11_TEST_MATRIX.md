# Phase 11 — Test Matrix dan Quality Gate

Dokumen ini memetakan Definition of Done MVP ke test yang dapat dijalankan ulang.
Semua integration/E2E test menulis data sementara ke Supabase staging dan wajib
menggunakan Midtrans Sandbox (`MIDTRANS_IS_PRODUCTION=false`).

## Matriks coverage

| Risiko / requirement | Unit | Integration staging | E2E browser |
|---|---|---|---|
| Session, role, ownership, inactive/error contract | `lib/auth/*.test.ts`, `proxy.test.ts` | Phase 3, 4, 6, 7, 9, 10 | Anonim ditolak; wali ditolak dari admin |
| Satu akun banyak anak dan isolasi antar-wali | Authorization rules | Phase 4, 8 | Dashboard wali menampilkan dua anak |
| Kuota jalur/kategori tidak bocor | Calon murid/master-data rules | Phase 4 (request paralel) | — |
| Matrix biaya dan nominal server-side | Master-data/payment rules | Phase 4 dan 5 | — |
| Signature, status, sanitasi, idempotency webhook | Payment rules | Phase 5 | — |
| Gate enrollment setelah payment verified | Enrollment rules/schema | Phase 5 dan 6 | — |
| Assessment dan release announcement | Stage rules/schema | Phase 7 | — |
| TCP → Reguler dan FIFO | Fallback rules | Phase 8 | — |
| Race reprocess fallback | Fallback quota rules | Phase 8 (dua reprocess paralel) | — |
| Auto-delete, konfirmasi, snapshot, retention pembayaran | Fallback rules | Phase 8 | — |
| DU manual dan status WhatsApp | Admission rules/schema | Phase 9 | — |
| Filter dan Excel/CSV aman | Reporting rules/schema/export | Phase 10 | Admin memfilter laporan |
| Routing publik dan UI mobile | — | — | Chromium viewport 390×844 |

## Perintah

Pemeriksaan lokal tanpa koneksi eksternal:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Install browser satu kali:

```bash
npm run test:e2e:install
```

E2E saja (memerlukan build production dan staging):

```bash
npm run build
npm run test:e2e
```

Seluruh integration test staging saja:

```bash
npm run build
npm run test:integration
```

Quality gate lengkap Phase 11:

```bash
npm run test:phase11
```

Runner menyalakan Next.js production di `127.0.0.1:3000`, menjalankan migration
verification, integration Phase Auth dan Phase 3–10 secara berurutan, kemudian
E2E Chromium. Data fixture dibersihkan pada akhir masing-masing suite.

## Batas keamanan

- Jangan jalankan quality gate terhadap Supabase production.
- Runner menolak `MIDTRANS_IS_PRODUCTION=true`.
- Jangan menyimpan trace, screenshot, atau video kegagalan yang berisi data nyata.
- Gunakan akun dan data dummy; fixture E2E memakai domain `example.invalid`.
- Hapus artifact `test-results/` dan `playwright-report/` setelah investigasi lokal.
