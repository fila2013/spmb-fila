BEGIN;

ALTER TABLE "form_field"
  ADD COLUMN "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "form_field"
  DROP CONSTRAINT "form_field_auto_fill_source_valid_check";

ALTER TABLE "form_field"
  ADD CONSTRAINT "form_field_auto_fill_source_valid_check" CHECK (
    "auto_fill_source" IS NULL OR "auto_fill_source" IN (
      'akun_email', 'kategori_asal_tk', 'tempat_lahir', 'tanggal_lahir', 'nama_anak'
    )
  );

-- Keep every existing form_response intact. Existing answers take precedence
-- over the new default when the enrollment form is loaded.
DO $$
DECLARE
  name_field_id UUID;
  gender_field_id UUID;
BEGIN
  IF (SELECT count(*) FROM "form_field"
      WHERE "form_type" = 'data_pribadi'::"form_type"
        AND lower(trim("label")) IN ('nama lengkap', 'nama lengkap anak')) > 1
     OR (SELECT count(*) FROM "form_field"
      WHERE "form_type" = 'data_pribadi'::"form_type"
        AND lower(trim("label")) = 'jenis kelamin') > 1 THEN
    RAISE EXCEPTION 'Field Nama lengkap/Jenis Kelamin duplikat; migration dibatalkan tanpa perubahan.';
  END IF;

  SELECT "id" INTO name_field_id FROM "form_field"
  WHERE "form_type" = 'data_pribadi'::"form_type"
    AND lower(trim("label")) IN ('nama lengkap', 'nama lengkap anak');

  SELECT "id" INTO gender_field_id FROM "form_field"
  WHERE "form_type" = 'data_pribadi'::"form_type"
    AND lower(trim("label")) = 'jenis kelamin';

  IF EXISTS (SELECT 1 FROM "form_field"
      WHERE "id" IN (name_field_id, gender_field_id)
        AND ("archived_at" IS NOT NULL OR "tipe_input" <> 'text'::"tipe_input")) THEN
    RAISE EXCEPTION 'Field Nama lengkap/Jenis Kelamin perlu pemeriksaan manual; migration dibatalkan tanpa perubahan.';
  END IF;

  IF name_field_id IS NULL THEN
    INSERT INTO "form_field" ("id", "form_type", "label", "tipe_input", "wajib", "urutan")
    VALUES (gen_random_uuid(), 'data_pribadi'::"form_type", 'Nama lengkap', 'text'::"tipe_input", true, 0)
    RETURNING "id" INTO name_field_id;
  END IF;

  IF gender_field_id IS NULL THEN
    INSERT INTO "form_field" ("id", "form_type", "label", "tipe_input", "wajib", "urutan")
    VALUES (gen_random_uuid(), 'data_pribadi'::"form_type", 'Jenis Kelamin', 'text'::"tipe_input", true, 1)
    RETURNING "id" INTO gender_field_id;
  END IF;

  UPDATE "form_field"
  SET "auto_fill_source" = 'nama_anak'
  WHERE "id" = name_field_id;

  UPDATE "form_field"
  SET "tipe_input" = 'option'::"tipe_input",
      "options" = ARRAY['Laki-Laki', 'Perempuan']::TEXT[]
  WHERE "id" = gender_field_id;
END $$;

ALTER TABLE "form_field"
  ADD CONSTRAINT "form_field_options_valid_check" CHECK (
    ("tipe_input" = 'option'::"tipe_input" AND cardinality("options") BETWEEN 2 AND 20)
    OR ("tipe_input" <> 'option'::"tipe_input" AND cardinality("options") = 0)
  );

COMMIT;
