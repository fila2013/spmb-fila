-- A failed or expired Midtrans order cannot be reused. Keep every attempt as a
-- financial audit row while retaining unique order/transaction identifiers.
DROP INDEX "pembayaran_calon_murid_reference_jenis_key";

CREATE INDEX "pembayaran_calon_murid_reference_jenis_created_at_idx"
  ON "pembayaran"("calon_murid_reference", "jenis", "created_at");
