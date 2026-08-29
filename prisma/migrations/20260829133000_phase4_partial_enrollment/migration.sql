-- Phase 4 creates a child first, then selects a route and category in separate
-- guarded steps. Nullable foreign keys represent only that short-lived draft.
ALTER TABLE "calon_murid"
  ALTER COLUMN "jalur_id" DROP NOT NULL,
  ALTER COLUMN "kategori_id" DROP NOT NULL;

ALTER TABLE "calon_murid"
  ADD CONSTRAINT "calon_murid_tahap_pilihan_consistent_check"
    CHECK (
      "status_keseluruhan" = 'pilih_jalur'
      OR ("jalur_id" IS NOT NULL AND "kategori_id" IS NOT NULL)
    );

COMMENT ON COLUMN "calon_murid"."jalur_id" IS
  'Boleh NULL hanya selama draft status pilih_jalur sebelum wali memilih jalur.';

COMMENT ON COLUMN "calon_murid"."kategori_id" IS
  'Boleh NULL hanya selama draft status pilih_jalur sebelum wali memilih kategori.';
