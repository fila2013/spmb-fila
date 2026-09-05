import { StatusKeseluruhan } from "@/generated/prisma/enums";

export const statusPresentation: Record<
  StatusKeseluruhan,
  { label: string; className: string }
> = {
  [StatusKeseluruhan.PILIH_JALUR]: {
    label: "Pilih Jalur",
    className: "bg-amber-100 text-amber-900",
  },
  [StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR]: {
    label: "Menunggu Pembayaran",
    className: "bg-sky-100 text-sky-900",
  },
  [StatusKeseluruhan.ENROLLMENT]: {
    label: "Lengkapi Data",
    className: "bg-sky-100 text-sky-900",
  },
  [StatusKeseluruhan.MENUNGGU_ASESMEN]: {
    label: "Menunggu Asesmen",
    className: "bg-violet-100 text-violet-900",
  },
  [StatusKeseluruhan.MENUNGGU_PENGUMUMAN]: {
    label: "Menunggu Pengumuman",
    className: "bg-violet-100 text-violet-900",
  },
  [StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR]: {
    label: "Pilih Kelas Final",
    className: "bg-amber-100 text-amber-900",
  },
  [StatusKeseluruhan.DITERIMA]: {
    label: "Diterima",
    className: "bg-emerald-100 text-emerald-900",
  },
  [StatusKeseluruhan.TIDAK_DITERIMA]: {
    label: "Tidak Diterima",
    className: "bg-red-100 text-red-900",
  },
  [StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK]: {
    label: "Menunggu Kuota Reguler",
    className: "bg-amber-100 text-amber-900",
  },
  [StatusKeseluruhan.MENUNGGU_DU]: {
    label: "Daftar Ulang",
    className: "bg-sky-100 text-sky-900",
  },
  [StatusKeseluruhan.MENUNGGU_JOIN_WA]: {
    label: "Join WhatsApp",
    className: "bg-sky-100 text-sky-900",
  },
  [StatusKeseluruhan.SELESAI]: {
    label: "Selesai",
    className: "bg-emerald-100 text-emerald-900",
  },
};
