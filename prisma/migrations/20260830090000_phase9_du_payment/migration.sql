-- Pembayaran DU dibuat saat wali mengunggah bukti. Nominal aktual baru
-- dipercaya setelah admin mencocokkannya dengan bukti pada saat verifikasi.
ALTER TABLE "pembayaran"
  ALTER COLUMN "nominal" DROP NOT NULL;

ALTER TABLE "pembayaran"
  DROP CONSTRAINT "pembayaran_nominal_positive_check",
  ADD CONSTRAINT "pembayaran_nominal_valid_check"
    CHECK (
      ("jenis" = 'pendaftaran' AND "nominal" > 0)
      OR
      ("jenis" = 'du' AND ("nominal" IS NULL OR "nominal" > 0))
    ),
  ADD CONSTRAINT "pembayaran_du_verified_nominal_check"
    CHECK (
      "jenis" <> 'du'
      OR "status" <> 'verified'
      OR "nominal" > 0
    );

-- Satu anak hanya boleh memiliki satu transaksi DU yang masih aktif. Riwayat
-- rejected tetap dipertahankan dan wali dapat mengunggah percobaan baru.
CREATE UNIQUE INDEX "pembayaran_du_active_per_child_key"
  ON "pembayaran" ("calon_murid_reference")
  WHERE "jenis" = 'du' AND "status" IN ('pending', 'verified');

CREATE INDEX "status_grup_wa_status_updated_at_idx"
  ON "status_grup_wa" ("status", "updated_at");

COMMENT ON COLUMN "pembayaran"."nominal" IS
  'Wajib positif untuk pendaftaran dan DU verified; boleh NULL hanya saat bukti DU menunggu/rejected sebelum nominal dikonfirmasi admin.';
