-- A finalized manual payment remains part of the financial ledger even after
-- Admin removes its proof file. Pending payments still require a proof so they
-- cannot be reviewed without an uploaded document.
ALTER TABLE "pembayaran"
  DROP CONSTRAINT "pembayaran_metode_detail_check",
  ADD CONSTRAINT "pembayaran_metode_detail_check"
    CHECK (
      (
        "metode_pembayaran" = 'midtrans'
        AND "midtrans_order_id" IS NOT NULL
        AND "midtrans_snap_token" IS NOT NULL
      )
      OR
      (
        "metode_pembayaran" = 'manual_transfer'
        AND (
          "file_bukti_url" IS NOT NULL
          OR "status" IN ('verified', 'rejected')
        )
      )
    );
