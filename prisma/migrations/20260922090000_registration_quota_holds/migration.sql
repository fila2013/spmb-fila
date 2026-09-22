-- Registration quota is held temporarily while payment is pending and becomes
-- permanent only after the registration payment is verified.
CREATE TYPE "status_hold_kuota" AS ENUM (
  'pending_payment',
  'verified',
  'expired',
  'cancelled'
);

ALTER TABLE "pengaturan_pembayaran"
  ADD COLUMN "hold_duration_minutes" INTEGER NOT NULL DEFAULT 1440,
  ADD CONSTRAINT "pengaturan_pembayaran_hold_duration_check"
    CHECK ("hold_duration_minutes" BETWEEN 5 AND 10080);

CREATE TABLE "hold_kuota_pendaftaran" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "calon_murid_id" UUID NOT NULL,
  "jalur_id" UUID,
  "kategori_id" UUID NOT NULL,
  "status" "status_hold_kuota" NOT NULL DEFAULT 'pending_payment',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "verified_at" TIMESTAMPTZ(6),
  "released_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hold_kuota_pendaftaran_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hold_kuota_pendaftaran_state_check" CHECK (
    (
      "status" = 'pending_payment'
      AND "jalur_id" IS NOT NULL
      AND "verified_at" IS NULL
      AND "released_at" IS NULL
    )
    OR
    (
      "status" = 'verified'
      AND "verified_at" IS NOT NULL
      AND "released_at" IS NULL
    )
    OR
    (
      "status" IN ('expired', 'cancelled')
      AND "verified_at" IS NULL
      AND "released_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "hold_kuota_pendaftaran_calon_murid_id_key"
  ON "hold_kuota_pendaftaran"("calon_murid_id");
CREATE INDEX "hold_kuota_pendaftaran_status_expires_at_idx"
  ON "hold_kuota_pendaftaran"("status", "expires_at");
CREATE INDEX "hold_kuota_pendaftaran_jalur_id_status_expires_at_idx"
  ON "hold_kuota_pendaftaran"("jalur_id", "status", "expires_at");
CREATE INDEX "hold_kuota_pendaftaran_kategori_id_status_expires_at_idx"
  ON "hold_kuota_pendaftaran"("kategori_id", "status", "expires_at");

ALTER TABLE "hold_kuota_pendaftaran"
  ADD CONSTRAINT "hold_kuota_pendaftaran_calon_murid_id_fkey"
    FOREIGN KEY ("calon_murid_id") REFERENCES "calon_murid"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "hold_kuota_pendaftaran_jalur_id_fkey"
    FOREIGN KEY ("jalur_id") REFERENCES "jalur"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hold_kuota_pendaftaran_kategori_id_fkey"
    FOREIGN KEY ("kategori_id") REFERENCES "kategori_pendaftar"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hold_kuota_pendaftaran" ENABLE ROW LEVEL SECURITY;

-- Convert existing data to the new meaning: unpaid participants already waiting
-- for payment receive a fresh hold, while only a VERIFIED registration payment
-- creates a permanent allocation. Drafts without a category have no hold.
INSERT INTO "hold_kuota_pendaftaran" (
  "calon_murid_id",
  "jalur_id",
  "kategori_id",
  "status",
  "expires_at",
  "verified_at"
)
SELECT
  child."id",
  child."jalur_id",
  child."kategori_id",
  CASE
    WHEN child."status_keseluruhan" = 'menunggu_verifikasi_bayar'
      AND verified_payment."verified_at" IS NULL
      THEN 'pending_payment'::"status_hold_kuota"
    ELSE 'verified'::"status_hold_kuota"
  END,
  CASE
    WHEN child."status_keseluruhan" = 'menunggu_verifikasi_bayar'
      AND verified_payment."verified_at" IS NULL
      THEN CURRENT_TIMESTAMP + make_interval(mins => setting."hold_duration_minutes")
    ELSE COALESCE(verified_payment."verified_at", child."updated_at", CURRENT_TIMESTAMP)
  END,
  CASE
    WHEN child."status_keseluruhan" = 'menunggu_verifikasi_bayar'
      AND verified_payment."verified_at" IS NULL
      THEN NULL
    ELSE COALESCE(verified_payment."verified_at", child."updated_at", CURRENT_TIMESTAMP)
  END
FROM "calon_murid" child
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (
      SELECT "hold_duration_minutes"
      FROM "pengaturan_pembayaran"
      WHERE "id" = 'pendaftaran'
    ),
    1440
  ) AS "hold_duration_minutes"
) setting
LEFT JOIN LATERAL (
  SELECT payment."verified_at"
  FROM "pembayaran" payment
  WHERE payment."calon_murid_reference" = child."id"
    AND payment."jenis" = 'pendaftaran'
    AND payment."status" = 'verified'
  ORDER BY payment."verified_at" DESC NULLS LAST
  LIMIT 1
) verified_payment ON TRUE
WHERE child."kategori_id" IS NOT NULL
  AND (
    verified_payment."verified_at" IS NOT NULL
    OR child."status_keseluruhan" = 'menunggu_verifikasi_bayar'
  );

-- kuota_terpakai now means verified permanent allocations only. Active pending
-- holds are counted separately by the application when presenting availability.
UPDATE "jalur" route
SET "kuota_terpakai" = (
  SELECT COUNT(*)::INTEGER
  FROM "hold_kuota_pendaftaran" hold
  WHERE hold."jalur_id" = route."id"
    AND hold."status" = 'verified'
);

UPDATE "kategori_pendaftar" category
SET "kuota_terpakai" = (
  SELECT COUNT(*)::INTEGER
  FROM "hold_kuota_pendaftaran" hold
  WHERE hold."kategori_id" = category."id"
    AND hold."status" = 'verified'
);

COMMENT ON TABLE "hold_kuota_pendaftaran" IS
  'Hold kuota jalur/kategori selama pembayaran pendaftaran; hanya status verified yang masuk kuota_terpakai.';
COMMENT ON COLUMN "pengaturan_pembayaran"."hold_duration_minutes" IS
  'Durasi hold pembayaran pendaftaran dalam menit; minimum 5 menit dan maksimum 7 hari.';
