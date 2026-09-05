-- Optional post-announcement route choice for an accepted TCP participant.
-- Existing routes and participants remain unchanged because the feature flag
-- defaults to false and all choice fields are nullable.
CREATE TYPE "pilihan_jalur_final" AS ENUM ('tetap_jalur_asal', 'jalur_fallback');

ALTER TYPE "status_keseluruhan" ADD VALUE 'menunggu_pilihan_jalur' BEFORE 'diterima';

ALTER TABLE "jalur"
  ADD COLUMN "pilihan_jalur_final_aktif" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "calon_murid"
  ADD COLUMN "pilihan_jalur_final" "pilihan_jalur_final",
  ADD COLUMN "pilihan_jalur_final_at" TIMESTAMPTZ(6);

CREATE INDEX "calon_murid_pilihan_jalur_final_pilihan_jalur_final_at_idx"
  ON "calon_murid"("pilihan_jalur_final", "pilihan_jalur_final_at");

ALTER TABLE "jalur"
  ADD CONSTRAINT "jalur_pilihan_final_memerlukan_fallback_check"
  CHECK (NOT "pilihan_jalur_final_aktif" OR "fallback_jalur_id" IS NOT NULL);

ALTER TABLE "calon_murid"
  ADD CONSTRAINT "calon_murid_pilihan_final_timestamp_check"
  CHECK (
    ("pilihan_jalur_final" IS NULL AND "pilihan_jalur_final_at" IS NULL)
    OR
    ("pilihan_jalur_final" IS NOT NULL AND "pilihan_jalur_final_at" IS NOT NULL)
  ),
  ADD CONSTRAINT "calon_murid_menunggu_pilihan_final_check"
  CHECK (
    "status_keseluruhan" <> 'menunggu_pilihan_jalur'
    OR (
      "jalur_id" IS NOT NULL
      AND "pilihan_jalur_final" IS NULL
      AND "menunggu_fallback_jalur_id" IS NULL
    )
  ),
  ADD CONSTRAINT "calon_murid_tetap_jalur_final_check"
  CHECK (
    "pilihan_jalur_final" <> 'tetap_jalur_asal'
    OR (
      "jalur_id" IS NOT NULL
      AND "menunggu_fallback_jalur_id" IS NULL
    )
  ),
  ADD CONSTRAINT "calon_murid_fallback_final_check"
  CHECK (
    "pilihan_jalur_final" <> 'jalur_fallback'
    OR (
      "jalur_asal_id" IS NOT NULL
      AND (
        (
          "status_keseluruhan" = 'menunggu_kuota_fallback'
          AND "jalur_id" IS NULL
          AND "menunggu_fallback_jalur_id" IS NOT NULL
        )
        OR
        (
          "status_keseluruhan" <> 'menunggu_kuota_fallback'
          AND "jalur_id" IS NOT NULL
          AND "menunggu_fallback_jalur_id" IS NULL
        )
      )
    )
  );

COMMENT ON COLUMN "jalur"."pilihan_jalur_final_aktif" IS
  'Jika aktif pada jalur yang memiliki fallback, peserta yang diterima wajib memilih tetap di jalur asal atau pindah ke fallback sebelum DU.';

COMMENT ON COLUMN "calon_murid"."pilihan_jalur_final" IS
  'Pilihan final satu kali setelah peserta pada jalur khusus dinyatakan diterima.';
