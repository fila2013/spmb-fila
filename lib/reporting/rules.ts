import {
  JenisPembayaran,
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusPengumuman,
  StatusUndanganWa,
} from "@/generated/prisma/enums";
import type { ReportingFilters } from "@/lib/reporting/schemas";

export type PaymentSummary = {
  jenis: JenisPembayaran;
  status: StatusPembayaran;
  nominal: number | null;
  verifiedAt: Date | null;
};

export type FilterableParticipant = {
  statusKeseluruhan: StatusKeseluruhan;
  hasilAssessment: { status: StatusAssessment } | null;
  pengumuman: { statusAkhir: StatusPengumuman | null } | null;
  statusGrupWa: { status: StatusUndanganWa } | null;
  pembayaran: PaymentSummary[];
};

const incompleteEnrollmentStatuses = new Set<StatusKeseluruhan>([
  StatusKeseluruhan.PILIH_JALUR,
  StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
  StatusKeseluruhan.ENROLLMENT,
]);

export function enrollmentStatus(status: StatusKeseluruhan) {
  return incompleteEnrollmentStatuses.has(status) ? "BELUM_LENGKAP" : "LENGKAP";
}

export function currentPayment(
  payments: PaymentSummary[],
  kind: JenisPembayaran,
) {
  return payments.find((payment) => payment.jenis === kind) ?? null;
}

export function matchesOperationalFilters(
  participant: FilterableParticipant,
  filters: ReportingFilters,
) {
  const registration = currentPayment(participant.pembayaran, JenisPembayaran.PENDAFTARAN);
  const du = currentPayment(participant.pembayaran, JenisPembayaran.DU);

  if (filters.statusPembayaran === "BELUM_ADA" && registration) return false;
  if (filters.statusPembayaran && filters.statusPembayaran !== "BELUM_ADA" && registration?.status !== filters.statusPembayaran) return false;
  if (filters.statusEnrollment && enrollmentStatus(participant.statusKeseluruhan) !== filters.statusEnrollment) return false;
  if (filters.statusAssessment && (participant.hasilAssessment?.status ?? StatusAssessment.BELUM) !== filters.statusAssessment) return false;
  if (filters.statusKelulusan === "MENUNGGU" && participant.pengumuman?.statusAkhir) return false;
  if (filters.statusKelulusan && filters.statusKelulusan !== "MENUNGGU" && participant.pengumuman?.statusAkhir !== filters.statusKelulusan) return false;
  if (filters.statusDu === "BELUM_ADA" && du) return false;
  if (filters.statusDu && filters.statusDu !== "BELUM_ADA" && du?.status !== filters.statusDu) return false;
  if (filters.statusWa === "BELUM_ADA" && participant.statusGrupWa) return false;
  if (filters.statusWa && filters.statusWa !== "BELUM_ADA" && participant.statusGrupWa?.status !== filters.statusWa) return false;
  return true;
}
