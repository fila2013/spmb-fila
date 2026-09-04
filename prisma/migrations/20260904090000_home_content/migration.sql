-- Beranda menggunakan model konten tahap yang sudah memiliki urutan, status,
-- gambar, audit, dan bucket CMS. Konten beranda selalu bersifat global.
ALTER TYPE "tahap_konten" ADD VALUE IF NOT EXISTS 'home';

ALTER TABLE "konten_tahap"
  ADD CONSTRAINT "konten_tahap_home_global_check"
  CHECK (
    "tahap"::text <> 'home'
    OR ("jalur_id" IS NULL AND "kategori_id" IS NULL)
  );
