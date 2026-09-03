import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import {
  FormType,
  KategoriTipe,
  ModePembayaranPendaftaran,
  PrismaClient,
  TipeInput,
} from "../generated/prisma/client";

config({ path: ".env.local", quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL atau DATABASE_URL wajib diisi untuk seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const dataPribadiFields: Array<{
  label: string;
  tipeInput: TipeInput;
  validasi?: string;
  autoFillSource?: string;
}> = [
  { label: "Nama lengkap", tipeInput: TipeInput.TEXT },
  { label: "Nama panggilan", tipeInput: TipeInput.TEXT },
  { label: "Tempat, tanggal lahir", tipeInput: TipeInput.TEXT },
  { label: "Nama ayah", tipeInput: TipeInput.TEXT },
  { label: "Nama ibu", tipeInput: TipeInput.TEXT },
  {
    label: "Email ayah/ibu",
    tipeInput: TipeInput.EMAIL,
    autoFillSource: "akun_email",
  },
  {
    label: "No. WA ayah",
    tipeInput: TipeInput.TEL,
    validasi: "format_wa_indonesia",
  },
  {
    label: "No. WA bunda",
    tipeInput: TipeInput.TEL,
    validasi: "format_wa_indonesia",
  },
  {
    label: "Asal TK",
    tipeInput: TipeInput.TEXT,
    autoFillSource: "kategori_asal_tk",
  },
];

const observasiFields = [
  "Bagaimana Bapak/Ibu menyelaraskan aturan di rumah dengan nilai-nilai sekolah?",
  "Karakter dan kompetensi utama apa yang paling diharapkan terbentuk pada anak?",
  ...Array.from(
    { length: 8 },
    (_, index) => `Pertanyaan observasi ${index + 3}`,
  ),
];

async function main() {
  await prisma.$transaction(async (transaction) => {
    await transaction.pengaturanPembayaran.upsert({
      where: { id: "pendaftaran" },
      update: {},
      create: {
        id: "pendaftaran",
        mode: ModePembayaranPendaftaran.MIDTRANS,
      },
    });
    const reguler = await transaction.jalur.upsert({
      where: { nama: "Reguler" },
      update: { hapusDataJikaGagal: true },
      create: { nama: "Reguler", hapusDataJikaGagal: true },
    });

    await transaction.jalur.upsert({
      where: { nama: "TCP" },
      update: { fallbackJalurId: reguler.id, hapusDataJikaGagal: false },
      create: {
        nama: "TCP",
        fallbackJalurId: reguler.id,
        hapusDataJikaGagal: false,
      },
    });

    await transaction.jalur.upsert({
      where: { nama: "Pindahan" },
      update: { hapusDataJikaGagal: true },
      create: { nama: "Pindahan", hapusDataJikaGagal: true },
    });

    await transaction.kategoriPendaftar.upsert({
      where: { nama: "Alumni TKIT" },
      update: { tipe: KategoriTipe.ALUMNI_TKFI },
      create: { nama: "Alumni TKIT", tipe: KategoriTipe.ALUMNI_TKFI },
    });

    await transaction.kategoriPendaftar.upsert({
      where: { nama: "Eksternal/Umum" },
      update: { tipe: KategoriTipe.EKSTERNAL },
      create: { nama: "Eksternal/Umum", tipe: KategoriTipe.EKSTERNAL },
    });

    for (const [index, field] of dataPribadiFields.entries()) {
      await transaction.formField.upsert({
        where: {
          formType_label: {
            formType: FormType.DATA_PRIBADI,
            label: field.label,
          },
        },
        update: {
          tipeInput: field.tipeInput,
          validasi: field.validasi,
          autoFillSource: field.autoFillSource,
          wajib: true,
          urutan: index,
        },
        create: {
          formType: FormType.DATA_PRIBADI,
          label: field.label,
          tipeInput: field.tipeInput,
          validasi: field.validasi,
          autoFillSource: field.autoFillSource,
          wajib: true,
          urutan: index,
        },
      });
    }

    for (const [index, label] of observasiFields.entries()) {
      await transaction.formField.upsert({
        where: { formType_label: { formType: FormType.OBSERVASI, label } },
        update: { tipeInput: TipeInput.TEXTAREA, wajib: true, urutan: index },
        create: {
          formType: FormType.OBSERVASI,
          label,
          tipeInput: TipeInput.TEXTAREA,
          wajib: true,
          urutan: index,
        },
      });
    }
  });
}

try {
  await main();
  console.log("Seed development SPMB FILA selesai.");
} finally {
  await prisma.$disconnect();
}
