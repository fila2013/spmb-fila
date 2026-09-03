-- Registration payment can be switched by Admin without removing Midtrans.
CREATE TYPE "mode_pembayaran_pendaftaran" AS ENUM ('midtrans', 'manual');

CREATE TABLE "pengaturan_pembayaran" (
  "id" VARCHAR(30) NOT NULL DEFAULT 'pendaftaran',
  "mode" "mode_pembayaran_pendaftaran" NOT NULL DEFAULT 'midtrans',
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pengaturan_pembayaran_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pengaturan_pembayaran_singleton_check"
    CHECK ("id" = 'pendaftaran')
);

INSERT INTO "pengaturan_pembayaran" ("id", "mode")
VALUES ('pendaftaran', 'midtrans');

CREATE TABLE "rekening_bank" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nama_bank" VARCHAR(100) NOT NULL,
  "nomor_rekening" VARCHAR(30) NOT NULL,
  "atas_nama" VARCHAR(150) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rekening_bank_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rekening_bank_nama_check"
    CHECK (NULLIF(BTRIM("nama_bank"), '') IS NOT NULL),
  CONSTRAINT "rekening_bank_nomor_check"
    CHECK ("nomor_rekening" ~ '^[0-9]{5,30}$'),
  CONSTRAINT "rekening_bank_atas_nama_check"
    CHECK (NULLIF(BTRIM("atas_nama"), '') IS NOT NULL)
);

CREATE UNIQUE INDEX "rekening_bank_nama_bank_nomor_rekening_key"
  ON "rekening_bank" ("nama_bank", "nomor_rekening");
CREATE INDEX "rekening_bank_created_at_idx"
  ON "rekening_bank" ("created_at");

ALTER TABLE "pengaturan_pembayaran"
  ADD CONSTRAINT "pengaturan_pembayaran_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing Midtrans detail checks remain intact. Only the allowed method for
-- registration is expanded; DU remains manual-only.
ALTER TABLE "pembayaran"
  DROP CONSTRAINT "pembayaran_jenis_metode_check",
  ADD CONSTRAINT "pembayaran_jenis_metode_check"
    CHECK (
      ("jenis" = 'pendaftaran' AND "metode_pembayaran" IN ('midtrans', 'manual_transfer'))
      OR
      ("jenis" = 'du' AND "metode_pembayaran" = 'manual_transfer')
    );

ALTER TABLE "pengaturan_pembayaran" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rekening_bank" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "pengaturan_pembayaran" IS
  'Konfigurasi singleton mode pembayaran pendaftaran yang dikelola Admin.';
COMMENT ON TABLE "rekening_bank" IS
  'Daftar rekening sekolah yang ditampilkan ketika mode pendaftaran manual aktif.';
