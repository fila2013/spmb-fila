-- Additive singleton configuration; existing participants, results and CMS blocks
-- are retained. Official defaults are provided by the application until saved.
BEGIN;

CREATE TABLE "template_surat_pengumuman" (
  "id" VARCHAR(30) NOT NULL DEFAULT 'utama',
  "diterima" TEXT NOT NULL,
  "tidak_diterima" TEXT NOT NULL,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "template_surat_pengumuman_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "template_surat_pengumuman_singleton_check" CHECK ("id" = 'utama'),
  CONSTRAINT "template_surat_pengumuman_text_check" CHECK (
    LENGTH(BTRIM("diterima")) BETWEEN 1 AND 10000 AND
    LENGTH(BTRIM("tidak_diterima")) BETWEEN 1 AND 10000
  ),
  CONSTRAINT "template_surat_pengumuman_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- No direct anon/authenticated access. Authorized server actions use Prisma.
ALTER TABLE "template_surat_pengumuman" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "template_surat_pengumuman" IS
  'Template master surat hasil seleksi yang dikelola Admin dan digabung di server setelah rilis.';

COMMIT;
