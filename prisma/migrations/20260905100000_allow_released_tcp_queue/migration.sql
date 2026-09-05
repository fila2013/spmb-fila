-- A participant who made the final choice to move to the fallback route no
-- longer occupies the source route while waiting for target capacity. This is
-- the only non-draft state where jalur_id may be NULL.
ALTER TABLE "calon_murid"
  DROP CONSTRAINT "calon_murid_tahap_pilihan_consistent_check";

ALTER TABLE "calon_murid"
  ADD CONSTRAINT "calon_murid_tahap_pilihan_consistent_check"
    CHECK (
      "status_keseluruhan" = 'pilih_jalur'
      OR (
        "kategori_id" IS NOT NULL
        AND (
          "jalur_id" IS NOT NULL
          OR (
            "status_keseluruhan" = 'menunggu_kuota_fallback'
            AND "pilihan_jalur_final" = 'jalur_fallback'
            AND "menunggu_fallback_jalur_id" IS NOT NULL
          )
        )
      )
    );

COMMENT ON COLUMN "calon_murid"."jalur_id" IS
  'Boleh NULL saat draft pilih_jalur atau setelah kuota jalur asal dilepas sementara peserta menunggu kuota fallback pilihannya.';
