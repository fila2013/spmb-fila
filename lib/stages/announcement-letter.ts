import { StatusPengumuman } from "@/generated/prisma/enums";

export const ANNOUNCEMENT_TEMPLATE_ID = "utama";
export const announcementVariables = [
  { token: "{nama_peserta}", description: "Nama lengkap anak" },
  { token: "{jalur}", description: "Nama jalur pendaftaran" },
  { token: "{status_keputusan}", description: "DITERIMA atau TIDAK DITERIMA" },
] as const;

export type AnnouncementTemplates = { diterima: string; tidakDiterima: string };

export const defaultAnnouncementTemplates: AnnouncementTemplates = {
  diterima: `PENGUMUMAN HASIL SELEKSI PENERIMAAN MURID BARU
SDIT FITRAH INSANI LANGKAPURA

Assalamu'alaikum warahmatullahi wabarakatuh.

Yth. Bapak/Ibu Orang Tua/Wali {nama_peserta},

Berdasarkan hasil seleksi penerimaan murid baru SDIT Fitrah Insani Langkapura, dengan ini kami menyampaikan bahwa:

Nama Peserta: {nama_peserta}
Jalur Pendaftaran: {jalur}
Keputusan: {status_keputusan}

Kami mengucapkan selamat kepada Ananda dan keluarga. Silakan melanjutkan tahapan daftar ulang sesuai petunjuk panitia melalui dashboard pendaftaran. Apabila pilihan jalur final tersedia, mohon selesaikan pilihan tersebut terlebih dahulu.

Terima kasih atas kepercayaan Bapak/Ibu kepada SDIT Fitrah Insani Langkapura.

Wassalamu'alaikum warahmatullahi wabarakatuh.

Panitia SPMB
SDIT Fitrah Insani Langkapura`,
  tidakDiterima: `PENGUMUMAN HASIL SELEKSI PENERIMAAN MURID BARU
SDIT FITRAH INSANI LANGKAPURA

Assalamu'alaikum warahmatullahi wabarakatuh.

Yth. Bapak/Ibu Orang Tua/Wali {nama_peserta},

Berdasarkan hasil seleksi penerimaan murid baru SDIT Fitrah Insani Langkapura, dengan ini kami menyampaikan bahwa:

Nama Peserta: {nama_peserta}
Jalur Pendaftaran: {jalur}
Keputusan: {status_keputusan}

Dengan hormat kami menyampaikan bahwa Ananda belum dapat kami terima pada penerimaan murid baru ini. Keputusan ini merupakan hasil proses seleksi panitia.

Kami mengucapkan terima kasih atas partisipasi dan kepercayaan Bapak/Ibu. Semoga Ananda senantiasa diberikan kemudahan dan kesempatan terbaik dalam menempuh pendidikan.

Wassalamu'alaikum warahmatullahi wabarakatuh.

Panitia SPMB
SDIT Fitrah Insani Langkapura`,
};

export function unknownAnnouncementVariables(text: string) {
  const supported = new Set<string>(announcementVariables.map(({ token }) => token));
  return [...text.matchAll(/\{[^{}\r\n]+\}/g)]
    .map(([token]) => token)
    .filter((token) => !supported.has(token));
}

export function renderAnnouncementLetter(
  templates: AnnouncementTemplates,
  input: { namaPeserta: string; jalur: string; status: StatusPengumuman },
) {
  const values: Record<string, string> = {
    nama_peserta: input.namaPeserta,
    jalur: input.jalur,
    status_keputusan: input.status === StatusPengumuman.DITERIMA ? "DITERIMA" : "TIDAK DITERIMA",
  };
  const text = input.status === StatusPengumuman.DITERIMA ? templates.diterima : templates.tidakDiterima;
  // A single pass keeps literal replacement values (including $ and braces) intact.
  return text.replace(/\{(nama_peserta|jalur|status_keputusan)\}/g, (_, key: string) => values[key]);
}
