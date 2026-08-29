# Midtrans Sandbox — Phase 5

Dokumen ini adalah keputusan sementara selama akun Midtrans Production masih
dalam proses validasi. Phase 5 wajib memakai Sandbox. Production baru diaktifkan
pada Phase 12 setelah persetujuan merchant dan smoke test terpisah.

## Environment

Nilai asli hanya disimpan di `.env.local` atau Vercel Environment Variables dan
tidak boleh masuk Git.

```text
MIDTRANS_MERCHANT_ID=<merchant Sandbox>
MIDTRANS_SERVER_KEY=<server key Sandbox, server-only>
MIDTRANS_CLIENT_KEY=<client key Sandbox>
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=<client key Sandbox yang sama>
MIDTRANS_IS_PRODUCTION=false
```

Untuk deployment Preview yang dapat menerima webhook:

```text
NEXT_PUBLIC_APP_URL=https://DOMAIN-PREVIEW
MIDTRANS_NOTIFICATION_URL=https://DOMAIN-PREVIEW/api/webhooks/midtrans
```

`MIDTRANS_NOTIFICATION_URL` wajib HTTPS. Jika diisi, request create Snap memakai
header resmi `X-Override-Notification`, sehingga webhook transaksi tersebut
langsung menuju deployment Preview. Jangan isi dengan `localhost`, alamat IP,
atau port non-standar karena tidak dapat dijangkau Midtrans.

## Endpoint Sandbox

```text
Snap API    https://app.sandbox.midtrans.com/snap/v1/transactions
Snap.js     https://app.sandbox.midtrans.com/snap/snap.js
Core API    https://api.sandbox.midtrans.com
Webhook app https://DOMAIN-PREVIEW/api/webhooks/midtrans
```

Server Key hanya dipakai sebagai Basic Auth di server. Browser hanya menerima
Client Key dan Snap token.

## Midtrans Sandbox Dashboard

Pada dashboard Sandbox, buka pengaturan payment/notification lalu isi Payment
Notification URL dengan:

```text
https://DOMAIN-PREVIEW/api/webhooks/midtrans
```

URL harus menerima POST tanpa redirect dan mengembalikan HTTP 200 setelah
payload lolos verifikasi. `X-Override-Notification` dari aplikasi akan menjadi
tujuan khusus untuk transaksi yang dibuat dari deployment Preview.

## Pengujian

Pengujian otomatis lokal:

```bash
npm run test:phase5-integration
```

Test membuat akun/data staging sementara, meminta Snap token nyata dari
Sandbox, memproses webhook bertanda tangan, memverifikasi retry/idempotency,
lalu membersihkan data database uji. Transaksi uji dapat tetap terlihat pada
riwayat dashboard Sandbox.

Untuk pengujian UI, gunakan akun wali murid dan metode pembayaran/simulator
Sandbox. Jangan membayar transaksi Sandbox memakai rekening, kartu, QRIS, atau
dana nyata.

## Gate Production

Jangan mengubah `MIDTRANS_IS_PRODUCTION=true` sebelum seluruh kondisi berikut
terpenuhi:

- merchant Production sudah disetujui;
- Production Server Key dan Client Key tersedia di environment Production;
- domain resmi dan endpoint webhook HTTPS sudah aktif;
- metode pembayaran Production sudah diaktifkan;
- smoke test Production disetujui dan dikoordinasikan dengan pihak sekolah;
- key Sandbox tidak tercampur dengan key Production.
