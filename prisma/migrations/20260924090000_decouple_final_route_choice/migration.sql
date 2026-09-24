-- Separate the route used after a failed selection from the optional route
-- offered to accepted participants. Existing enabled configurations keep the
-- same behavior by copying their former fallback into the new target column.
ALTER TABLE "jalur"
  ADD COLUMN "pilihan_jalur_final_target_id" UUID;

UPDATE "jalur"
SET "pilihan_jalur_final_target_id" = "fallback_jalur_id"
WHERE "pilihan_jalur_final_aktif" = true;

ALTER TABLE "jalur"
  DROP CONSTRAINT IF EXISTS "jalur_pilihan_final_memerlukan_fallback_check";

ALTER TABLE "jalur"
  ADD CONSTRAINT "jalur_pilihan_final_target_id_fkey"
    FOREIGN KEY ("pilihan_jalur_final_target_id")
    REFERENCES "jalur"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  ADD CONSTRAINT "jalur_pilihan_final_target_required_check"
    CHECK (
      NOT "pilihan_jalur_final_aktif"
      OR "pilihan_jalur_final_target_id" IS NOT NULL
    ),
  ADD CONSTRAINT "jalur_pilihan_final_target_not_self_check"
    CHECK (
      "pilihan_jalur_final_target_id" IS NULL
      OR "pilihan_jalur_final_target_id" <> "id"
    );

CREATE INDEX "jalur_pilihan_jalur_final_target_id_idx"
  ON "jalur"("pilihan_jalur_final_target_id");

COMMENT ON COLUMN "jalur"."pilihan_jalur_final_aktif" IS
  'Jika aktif, peserta yang diterima wajib memilih tetap di jalur asal atau pindah ke target pilihan final sebelum DU.';

COMMENT ON COLUMN "jalur"."pilihan_jalur_final_target_id" IS
  'Jalur alternatif untuk peserta diterima; independen dari fallback peserta yang tidak diterima.';
