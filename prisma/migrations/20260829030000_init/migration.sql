-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('wali_murid', 'admin');

-- CreateEnum
CREATE TYPE "kategori_tipe" AS ENUM ('alumni_tkfi', 'eksternal');

-- CreateEnum
CREATE TYPE "sub_kategori_alumni" AS ENUM ('tkit_fi_1', 'tkit_fi_2');

-- CreateEnum
CREATE TYPE "status_keseluruhan" AS ENUM ('pilih_jalur', 'menunggu_verifikasi_bayar', 'enrollment', 'menunggu_asesmen', 'menunggu_pengumuman', 'diterima', 'tidak_diterima', 'menunggu_kuota_fallback', 'menunggu_du', 'menunggu_join_wa', 'selesai');

-- CreateEnum
CREATE TYPE "form_type" AS ENUM ('data_pribadi', 'observasi');

-- CreateEnum
CREATE TYPE "tipe_input" AS ENUM ('text', 'textarea', 'date', 'number', 'email', 'tel');

-- CreateEnum
CREATE TYPE "jenis_pembayaran" AS ENUM ('pendaftaran', 'du');

-- CreateEnum
CREATE TYPE "metode_pembayaran" AS ENUM ('manual_transfer', 'midtrans');

-- CreateEnum
CREATE TYPE "status_pembayaran" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "tahap_konten" AS ENUM ('assessment', 'announcement', 'admission_fee', 'join_wa');

-- CreateEnum
CREATE TYPE "status_assessment" AS ENUM ('belum', 'hadir', 'tidak_hadir');

-- CreateEnum
CREATE TYPE "status_pengumuman" AS ENUM ('diterima', 'tidak_diterima');

-- CreateEnum
CREATE TYPE "status_undangan_wa" AS ENUM ('menunggu', 'sudah_diundang');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supabase_auth_user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'wali_murid',
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jalur" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" VARCHAR(50) NOT NULL,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "periode_mulai" DATE,
    "periode_selesai" DATE,
    "kuota_maks" INTEGER,
    "kuota_terpakai" INTEGER NOT NULL DEFAULT 0,
    "fallback_jalur_id" UUID,
    "hapus_data_jika_gagal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jalur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategori_pendaftar" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" VARCHAR(50) NOT NULL,
    "tipe" "kategori_tipe" NOT NULL,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "periode_mulai" DATE,
    "periode_selesai" DATE,
    "kuota_maks" INTEGER,
    "kuota_terpakai" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kategori_pendaftar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biaya_pendaftaran" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jalur_id" UUID NOT NULL,
    "kategori_id" UUID NOT NULL,
    "nominal" INTEGER NOT NULL,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biaya_pendaftaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calon_murid" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "nama_anak" VARCHAR(150) NOT NULL,
    "jalur_id" UUID NOT NULL,
    "kategori_id" UUID NOT NULL,
    "sub_kategori_enum" "sub_kategori_alumni",
    "sub_kategori_text" VARCHAR(150),
    "jalur_asal_id" UUID,
    "menunggu_fallback_jalur_id" UUID,
    "status_keseluruhan" "status_keseluruhan" NOT NULL DEFAULT 'pilih_jalur',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calon_murid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_field" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_type" "form_type" NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "tipe_input" "tipe_input" NOT NULL,
    "wajib" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "validasi" VARCHAR(50),
    "auto_fill_source" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_response" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calon_murid_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calon_murid_id" UUID,
    "calon_murid_reference" UUID NOT NULL,
    "jenis" "jenis_pembayaran" NOT NULL,
    "metode_pembayaran" "metode_pembayaran" NOT NULL,
    "nominal" INTEGER NOT NULL,
    "file_bukti_url" TEXT,
    "status" "status_pembayaran" NOT NULL DEFAULT 'pending',
    "catatan_admin" TEXT,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "midtrans_order_id" VARCHAR(100),
    "midtrans_transaction_id" VARCHAR(100),
    "midtrans_snap_token" TEXT,
    "midtrans_payment_type" VARCHAR(30),
    "midtrans_raw_payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "konten_tahap" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tahap" "tahap_konten" NOT NULL,
    "judul" VARCHAR(200) NOT NULL,
    "tanggal" DATE,
    "isi_teks" TEXT,
    "gambar_url" TEXT,
    "urutan_layout" INTEGER NOT NULL DEFAULT 0,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "jalur_id" UUID,
    "kategori_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "konten_tahap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hasil_assessment" (
    "calon_murid_id" UUID NOT NULL,
    "status" "status_assessment" NOT NULL DEFAULT 'belum',
    "catatan" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hasil_assessment_pkey" PRIMARY KEY ("calon_murid_id")
);

-- CreateTable
CREATE TABLE "pengumuman" (
    "calon_murid_id" UUID NOT NULL,
    "status_akhir" "status_pengumuman",
    "tanggal_rilis" DATE,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengumuman_pkey" PRIMARY KEY ("calon_murid_id")
);

-- CreateTable
CREATE TABLE "status_grup_wa" (
    "calon_murid_id" UUID NOT NULL,
    "status" "status_undangan_wa" NOT NULL DEFAULT 'menunggu',
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_grup_wa_pkey" PRIMARY KEY ("calon_murid_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_auth_user_id_key" ON "users"("supabase_auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jalur_nama_key" ON "jalur"("nama");

-- CreateIndex
CREATE INDEX "jalur_status_aktif_periode_mulai_periode_selesai_idx" ON "jalur"("status_aktif", "periode_mulai", "periode_selesai");

-- CreateIndex
CREATE INDEX "jalur_fallback_jalur_id_idx" ON "jalur"("fallback_jalur_id");

-- CreateIndex
CREATE UNIQUE INDEX "kategori_pendaftar_nama_key" ON "kategori_pendaftar"("nama");

-- CreateIndex
CREATE INDEX "kategori_pendaftar_status_aktif_periode_mulai_periode_seles_idx" ON "kategori_pendaftar"("status_aktif", "periode_mulai", "periode_selesai");

-- CreateIndex
CREATE INDEX "biaya_pendaftaran_status_aktif_idx" ON "biaya_pendaftaran"("status_aktif");

-- CreateIndex
CREATE UNIQUE INDEX "biaya_pendaftaran_jalur_id_kategori_id_key" ON "biaya_pendaftaran"("jalur_id", "kategori_id");

-- CreateIndex
CREATE INDEX "calon_murid_user_id_idx" ON "calon_murid"("user_id");

-- CreateIndex
CREATE INDEX "calon_murid_jalur_id_idx" ON "calon_murid"("jalur_id");

-- CreateIndex
CREATE INDEX "calon_murid_kategori_id_idx" ON "calon_murid"("kategori_id");

-- CreateIndex
CREATE INDEX "calon_murid_status_keseluruhan_idx" ON "calon_murid"("status_keseluruhan");

-- CreateIndex
CREATE INDEX "calon_murid_menunggu_fallback_jalur_id_created_at_idx" ON "calon_murid"("menunggu_fallback_jalur_id", "created_at");

-- CreateIndex
CREATE INDEX "form_field_form_type_urutan_idx" ON "form_field"("form_type", "urutan");

-- CreateIndex
CREATE UNIQUE INDEX "form_field_form_type_label_key" ON "form_field"("form_type", "label");

-- CreateIndex
CREATE INDEX "form_response_calon_murid_id_idx" ON "form_response"("calon_murid_id");

-- CreateIndex
CREATE INDEX "form_response_field_id_idx" ON "form_response"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_response_calon_murid_id_field_id_key" ON "form_response"("calon_murid_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "pembayaran_midtrans_order_id_key" ON "pembayaran"("midtrans_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pembayaran_midtrans_transaction_id_key" ON "pembayaran"("midtrans_transaction_id");

-- CreateIndex
CREATE INDEX "pembayaran_calon_murid_id_idx" ON "pembayaran"("calon_murid_id");

-- CreateIndex
CREATE INDEX "pembayaran_calon_murid_reference_idx" ON "pembayaran"("calon_murid_reference");

-- CreateIndex
CREATE INDEX "pembayaran_status_created_at_idx" ON "pembayaran"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pembayaran_calon_murid_reference_jenis_key" ON "pembayaran"("calon_murid_reference", "jenis");

-- CreateIndex
CREATE INDEX "konten_tahap_tahap_status_aktif_urutan_layout_idx" ON "konten_tahap"("tahap", "status_aktif", "urutan_layout");

-- CreateIndex
CREATE INDEX "konten_tahap_jalur_id_kategori_id_idx" ON "konten_tahap"("jalur_id", "kategori_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_created_at_idx" ON "audit_log"("entity", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");

-- AddForeignKey
ALTER TABLE "jalur" ADD CONSTRAINT "jalur_fallback_jalur_id_fkey" FOREIGN KEY ("fallback_jalur_id") REFERENCES "jalur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biaya_pendaftaran" ADD CONSTRAINT "biaya_pendaftaran_jalur_id_fkey" FOREIGN KEY ("jalur_id") REFERENCES "jalur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biaya_pendaftaran" ADD CONSTRAINT "biaya_pendaftaran_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "kategori_pendaftar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calon_murid" ADD CONSTRAINT "calon_murid_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calon_murid" ADD CONSTRAINT "calon_murid_jalur_id_fkey" FOREIGN KEY ("jalur_id") REFERENCES "jalur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calon_murid" ADD CONSTRAINT "calon_murid_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "kategori_pendaftar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calon_murid" ADD CONSTRAINT "calon_murid_jalur_asal_id_fkey" FOREIGN KEY ("jalur_asal_id") REFERENCES "jalur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calon_murid" ADD CONSTRAINT "calon_murid_menunggu_fallback_jalur_id_fkey" FOREIGN KEY ("menunggu_fallback_jalur_id") REFERENCES "jalur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response" ADD CONSTRAINT "form_response_calon_murid_id_fkey" FOREIGN KEY ("calon_murid_id") REFERENCES "calon_murid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response" ADD CONSTRAINT "form_response_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "form_field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_calon_murid_id_fkey" FOREIGN KEY ("calon_murid_id") REFERENCES "calon_murid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konten_tahap" ADD CONSTRAINT "konten_tahap_jalur_id_fkey" FOREIGN KEY ("jalur_id") REFERENCES "jalur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konten_tahap" ADD CONSTRAINT "konten_tahap_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "kategori_pendaftar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hasil_assessment" ADD CONSTRAINT "hasil_assessment_calon_murid_id_fkey" FOREIGN KEY ("calon_murid_id") REFERENCES "calon_murid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengumuman" ADD CONSTRAINT "pengumuman_calon_murid_id_fkey" FOREIGN KEY ("calon_murid_id") REFERENCES "calon_murid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengumuman" ADD CONSTRAINT "pengumuman_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_grup_wa" ADD CONSTRAINT "status_grup_wa_calon_murid_id_fkey" FOREIGN KEY ("calon_murid_id") REFERENCES "calon_murid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_grup_wa" ADD CONSTRAINT "status_grup_wa_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain constraints that Prisma schema cannot represent directly.
ALTER TABLE "jalur"
  ADD CONSTRAINT "jalur_periode_valid_check"
    CHECK ("periode_mulai" IS NULL OR "periode_selesai" IS NULL OR "periode_mulai" <= "periode_selesai"),
  ADD CONSTRAINT "jalur_kuota_valid_check"
    CHECK ("kuota_maks" IS NULL OR ("kuota_maks" >= 0 AND "kuota_terpakai" <= "kuota_maks")),
  ADD CONSTRAINT "jalur_kuota_terpakai_nonnegative_check"
    CHECK ("kuota_terpakai" >= 0),
  ADD CONSTRAINT "jalur_fallback_bukan_diri_sendiri_check"
    CHECK ("fallback_jalur_id" IS NULL OR "fallback_jalur_id" <> "id");

ALTER TABLE "kategori_pendaftar"
  ADD CONSTRAINT "kategori_pendaftar_periode_valid_check"
    CHECK ("periode_mulai" IS NULL OR "periode_selesai" IS NULL OR "periode_mulai" <= "periode_selesai"),
  ADD CONSTRAINT "kategori_pendaftar_kuota_valid_check"
    CHECK ("kuota_maks" IS NULL OR ("kuota_maks" >= 0 AND "kuota_terpakai" <= "kuota_maks")),
  ADD CONSTRAINT "kategori_pendaftar_kuota_terpakai_nonnegative_check"
    CHECK ("kuota_terpakai" >= 0);

ALTER TABLE "biaya_pendaftaran"
  ADD CONSTRAINT "biaya_pendaftaran_nominal_positive_check"
    CHECK ("nominal" > 0);

ALTER TABLE "calon_murid"
  ADD CONSTRAINT "calon_murid_sub_kategori_tunggal_check"
    CHECK ("sub_kategori_enum" IS NULL OR "sub_kategori_text" IS NULL),
  ADD CONSTRAINT "calon_murid_antrian_fallback_consistent_check"
    CHECK (
      ("status_keseluruhan" = 'menunggu_kuota_fallback' AND "menunggu_fallback_jalur_id" IS NOT NULL)
      OR
      ("status_keseluruhan" <> 'menunggu_kuota_fallback' AND "menunggu_fallback_jalur_id" IS NULL)
    );

ALTER TABLE "form_field"
  ADD CONSTRAINT "form_field_urutan_nonnegative_check"
    CHECK ("urutan" >= 0),
  ADD CONSTRAINT "form_field_auto_fill_source_valid_check"
    CHECK ("auto_fill_source" IS NULL OR "auto_fill_source" IN ('akun_email', 'kategori_asal_tk'));

ALTER TABLE "pembayaran"
  ADD CONSTRAINT "pembayaran_nominal_positive_check"
    CHECK ("nominal" > 0),
  ADD CONSTRAINT "pembayaran_reference_consistent_check"
    CHECK ("calon_murid_id" IS NULL OR "calon_murid_id" = "calon_murid_reference"),
  ADD CONSTRAINT "pembayaran_jenis_metode_check"
    CHECK (
      ("jenis" = 'pendaftaran' AND "metode_pembayaran" = 'midtrans')
      OR
      ("jenis" = 'du' AND "metode_pembayaran" = 'manual_transfer')
    ),
  ADD CONSTRAINT "pembayaran_metode_detail_check"
    CHECK (
      ("metode_pembayaran" = 'midtrans' AND "midtrans_order_id" IS NOT NULL AND "midtrans_snap_token" IS NOT NULL)
      OR
      ("metode_pembayaran" = 'manual_transfer' AND "file_bukti_url" IS NOT NULL)
    ),
  ADD CONSTRAINT "pembayaran_verified_at_check"
    CHECK ("status" <> 'verified' OR "verified_at" IS NOT NULL),
  ADD CONSTRAINT "pembayaran_rejected_note_check"
    CHECK ("status" <> 'rejected' OR NULLIF(BTRIM("catatan_admin"), '') IS NOT NULL);

ALTER TABLE "konten_tahap"
  ADD CONSTRAINT "konten_tahap_urutan_nonnegative_check"
    CHECK ("urutan_layout" >= 0);

ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_detail_object_check"
    CHECK (jsonb_typeof("detail") = 'object');

COMMENT ON COLUMN "pembayaran"."calon_murid_reference" IS
  'Referensi UUID non-PII yang tetap disimpan setelah calon_murid dihapus untuk audit keuangan.';

COMMENT ON COLUMN "pembayaran"."calon_murid_id" IS
  'Relasi aktif ke calon_murid; menjadi NULL melalui ON DELETE SET NULL tanpa menghapus ledger pembayaran.';
