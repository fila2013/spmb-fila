-- Additive configuration for manual WhatsApp drafts. No existing rows change.
BEGIN;

CREATE TYPE "kategori_template_whatsapp" AS ENUM (
  'pengumuman_seleksi', 'pengingat_pembayaran', 'informasi_umum'
);

CREATE TABLE "template_pesan_whatsapp" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "judul" VARCHAR(120) NOT NULL,
  "kategori" "kategori_template_whatsapp" NOT NULL,
  "isi_pesan" VARCHAR(1000) NOT NULL,
  "status_aktif" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "template_pesan_whatsapp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "template_pesan_whatsapp_text_check" CHECK (
    "judul" ~ '[^[:space:]]' AND "isi_pesan" ~ '[^[:space:]]'
  ),
  CONSTRAINT "template_pesan_whatsapp_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "template_pesan_whatsapp_status_aktif_kategori_judul_idx"
  ON "template_pesan_whatsapp" ("status_aktif", "kategori", "judul");

-- No direct anon/authenticated access. Reads and writes go through Admin server code.
ALTER TABLE "template_pesan_whatsapp" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "template_pesan_whatsapp" IS
  'Template pesan untuk draf WhatsApp yang dibuka dan dikirim manual oleh Admin.';

COMMIT;
