BEGIN;

-- Nullable columns preserve every existing participant without inventing birth data.
ALTER TABLE "calon_murid"
  ADD COLUMN "tempat_lahir" VARCHAR(150),
  ADD COLUMN "tanggal_lahir" DATE;

ALTER TABLE "form_field"
  DROP CONSTRAINT "form_field_auto_fill_source_valid_check";

ALTER TABLE "form_field"
  ADD CONSTRAINT "form_field_auto_fill_source_valid_check" CHECK (
    "auto_fill_source" IS NULL OR "auto_fill_source" IN (
      'akun_email', 'kategori_asal_tk', 'tempat_lahir', 'tanggal_lahir'
    )
  );

-- The active Data Pribadi fields now read their values from the early registration.
UPDATE "form_field"
SET "auto_fill_source" = 'tempat_lahir'
WHERE "form_type" = 'data_pribadi'::"form_type"
  AND "label" = 'Tempat lahir'
  AND "archived_at" IS NULL;

UPDATE "form_field"
SET "auto_fill_source" = 'tanggal_lahir'
WHERE "form_type" = 'data_pribadi'::"form_type"
  AND "label" = 'Tanggal lahir'
  AND "archived_at" IS NULL;

COMMIT;
