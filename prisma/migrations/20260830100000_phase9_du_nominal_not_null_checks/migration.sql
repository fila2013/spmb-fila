-- PostgreSQL CHECK menerima hasil NULL. Karena itu kewajiban nominal harus
-- menyatakan IS NOT NULL secara eksplisit, bukan hanya `nominal > 0`.
ALTER TABLE "pembayaran"
  DROP CONSTRAINT "pembayaran_nominal_valid_check",
  DROP CONSTRAINT "pembayaran_du_verified_nominal_check",
  ADD CONSTRAINT "pembayaran_nominal_valid_check"
    CHECK (
      (
        "jenis" = 'pendaftaran'
        AND "nominal" IS NOT NULL
        AND "nominal" > 0
      )
      OR
      (
        "jenis" = 'du'
        AND ("nominal" IS NULL OR "nominal" > 0)
      )
    ),
  ADD CONSTRAINT "pembayaran_du_verified_nominal_check"
    CHECK (
      "jenis" <> 'du'
      OR "status" <> 'verified'
      OR ("nominal" IS NOT NULL AND "nominal" > 0)
    );
