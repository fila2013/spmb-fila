BEGIN;

ALTER TABLE "form_field"
  ADD COLUMN "min_age_years" INTEGER,
  ADD COLUMN "age_reference_month" INTEGER,
  ADD COLUMN "age_reference_year" INTEGER,
  ADD COLUMN "archived_at" TIMESTAMPTZ(6);

ALTER TABLE "form_field"
  ADD CONSTRAINT "form_field_age_rule_complete_check" CHECK (
    ("min_age_years" IS NULL AND "age_reference_month" IS NULL AND "age_reference_year" IS NULL)
    OR (
      "tipe_input" = 'date'::"tipe_input"
      AND "min_age_years" IS NOT NULL
      AND "age_reference_month" IS NOT NULL
      AND "age_reference_year" IS NOT NULL
      AND "min_age_years" BETWEEN 1 AND 30
      AND "age_reference_month" BETWEEN 1 AND 12
      AND "age_reference_year" BETWEEN 2000 AND 2200
    )
  );

-- Keep the legacy field and every existing form_response intact for audit/PDF.
-- Only the active form switches to the two new inputs.
DO $$
DECLARE
  legacy_order INTEGER;
BEGIN
  SELECT "urutan" INTO legacy_order
  FROM "form_field"
  WHERE "form_type" = 'data_pribadi'::"form_type"
    AND "label" = 'Tempat, tanggal lahir'
  LIMIT 1;

  IF legacy_order IS NULL THEN
    legacy_order := 2;
  ELSE
    UPDATE "form_field"
    SET "archived_at" = CURRENT_TIMESTAMP
    WHERE "form_type" = 'data_pribadi'::"form_type"
      AND "label" = 'Tempat, tanggal lahir'
      AND "archived_at" IS NULL;

    UPDATE "form_field"
    SET "urutan" = "urutan" + 1
    WHERE "form_type" = 'data_pribadi'::"form_type"
      AND "archived_at" IS NULL
      AND "urutan" > legacy_order;
  END IF;

  INSERT INTO "form_field" ("id", "form_type", "label", "tipe_input", "wajib", "urutan")
  VALUES (gen_random_uuid(), 'data_pribadi'::"form_type", 'Tempat lahir', 'text'::"tipe_input", true, legacy_order)
  ON CONFLICT ("form_type", "label") DO NOTHING;

  INSERT INTO "form_field" ("id", "form_type", "label", "tipe_input", "wajib", "urutan", "min_age_years", "age_reference_month", "age_reference_year")
  VALUES (gen_random_uuid(), 'data_pribadi'::"form_type", 'Tanggal lahir', 'date'::"tipe_input", true, legacy_order + 1, 6, 7, 2027)
  ON CONFLICT ("form_type", "label") DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM "form_field"
    WHERE "form_type" = 'data_pribadi'::"form_type"
      AND (("label" = 'Tempat lahir' AND ("tipe_input" <> 'text'::"tipe_input" OR "archived_at" IS NOT NULL))
        OR ("label" = 'Tanggal lahir' AND ("tipe_input" <> 'date'::"tipe_input" OR "archived_at" IS NOT NULL)))
  ) THEN
    RAISE EXCEPTION 'Field Tempat lahir/Tanggal lahir yang sudah ada memerlukan pemeriksaan manual; migration dibatalkan tanpa perubahan.';
  END IF;
END $$;

COMMIT;
