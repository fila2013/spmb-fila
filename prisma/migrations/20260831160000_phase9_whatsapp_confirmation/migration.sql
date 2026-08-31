-- Admin menyediakan tautan grup setelah DU terverifikasi. Wali harus membuka
-- tautan dan mengonfirmasi sendiri sebelum status pendaftaran menjadi selesai.
ALTER TABLE "status_grup_wa"
  ADD COLUMN "link_undangan" VARCHAR(2048),
  ADD COLUMN "link_ditetapkan_at" TIMESTAMPTZ(6),
  ADD COLUMN "link_dibuka_at" TIMESTAMPTZ(6),
  ADD COLUMN "dikonfirmasi_wali_at" TIMESTAMPTZ(6);

ALTER TABLE "status_grup_wa"
  ADD CONSTRAINT "status_grup_wa_link_valid_check"
    CHECK (
      "link_undangan" IS NULL
      OR "link_undangan" ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]+$'
    ),
  ADD CONSTRAINT "status_grup_wa_confirmation_order_check"
    CHECK (
      (
        "link_undangan" IS NULL
        AND "link_ditetapkan_at" IS NULL
        AND "link_dibuka_at" IS NULL
        AND "dikonfirmasi_wali_at" IS NULL
      )
      OR
      (
        "link_undangan" IS NOT NULL
        AND "link_ditetapkan_at" IS NOT NULL
        AND (
          "link_dibuka_at" IS NULL
          OR "link_dibuka_at" >= "link_ditetapkan_at"
        )
        AND (
          "dikonfirmasi_wali_at" IS NULL
          OR (
            "link_dibuka_at" IS NOT NULL
            AND "dikonfirmasi_wali_at" >= "link_dibuka_at"
          )
        )
      )
    );

COMMENT ON COLUMN "status_grup_wa"."link_undangan" IS
  'Tautan grup WhatsApp per peserta; hanya diekspos melalui redirect terotorisasi.';
COMMENT ON COLUMN "status_grup_wa"."link_dibuka_at" IS
  'Waktu wali pertama kali membuka redirect undangan dari aplikasi.';
COMMENT ON COLUMN "status_grup_wa"."dikonfirmasi_wali_at" IS
  'Waktu wali mengonfirmasi sudah bergabung; menjadi gate status selesai.';
