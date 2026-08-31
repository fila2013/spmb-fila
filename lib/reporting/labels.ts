import {
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusPengumuman,
  StatusUndanganWa,
  SubKategoriAlumni,
} from "@/generated/prisma/enums";
import { statusPresentation } from "@/lib/calon-murid/presentation";

export const paymentLabels: Record<StatusPembayaran, string> = {
  [StatusPembayaran.PENDING]: "Menunggu verifikasi",
  [StatusPembayaran.VERIFIED]: "Terverifikasi",
  [StatusPembayaran.REJECTED]: "Ditolak",
};

export const assessmentLabels: Record<StatusAssessment, string> = {
  [StatusAssessment.BELUM]: "Belum",
  [StatusAssessment.HADIR]: "Hadir",
  [StatusAssessment.TIDAK_HADIR]: "Tidak hadir",
};

export const announcementLabels: Record<StatusPengumuman, string> = {
  [StatusPengumuman.DITERIMA]: "Diterima",
  [StatusPengumuman.TIDAK_DITERIMA]: "Tidak diterima",
};

export const whatsappLabels: Record<StatusUndanganWa, string> = {
  [StatusUndanganWa.MENUNGGU]: "Menunggu bergabung",
  [StatusUndanganWa.SUDAH_DIUNDANG]: "Sudah bergabung",
};

export const subCategoryLabels: Record<SubKategoriAlumni, string> = {
  [SubKategoriAlumni.TKIT_FI_1]: "TKIT Fitrah Insani 1",
  [SubKategoriAlumni.TKIT_FI_2]: "TKIT Fitrah Insani 2",
};

export function overallStatusLabel(status: StatusKeseluruhan) {
  return statusPresentation[status].label;
}
