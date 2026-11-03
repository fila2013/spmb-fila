import type { KategoriTemplateWhatsapp } from "@/generated/prisma/enums";

export const WHATSAPP_TEMPLATE_TITLE_MAX = 120;
export const WHATSAPP_TEMPLATE_BODY_MAX = 1000;

export const whatsappTemplateCategoryLabels: Record<KategoriTemplateWhatsapp, string> = {
  PENGUMUMAN_SELEKSI: "Pengumuman Seleksi",
  PENGINGAT_PEMBAYARAN: "Pengingat Pembayaran",
  INFORMASI_UMUM: "Informasi Umum",
};

export const whatsappTemplateVariables = [
  { key: "nama_peserta", token: "{nama_peserta}", description: "Nama peserta" },
  { key: "nama_wali", token: "{nama_wali}", description: "Nama wali penerima" },
  { key: "jalur", token: "{jalur}", description: "Jalur pendaftaran peserta" },
  { key: "kategori", token: "{kategori}", description: "Kategori pendaftar" },
  { key: "status", token: "{status}", description: "Status tahapan peserta" },
] as const;

export type WhatsappTemplateSummary = {
  id: string;
  judul: string;
  kategori: KategoriTemplateWhatsapp;
  isiPesan: string;
};

export type WhatsappTemplateRecord = WhatsappTemplateSummary & { statusAktif: boolean };
