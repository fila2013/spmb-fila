import { describe, expect, it } from "vitest";

import {
  JenisPembayaran,
  StatusAssessment,
  StatusKeseluruhan,
  StatusPembayaran,
  StatusPengumuman,
  StatusUndanganWa,
} from "@/generated/prisma/enums";
import { enrollmentStatus, matchesOperationalFilters } from "@/lib/reporting/rules";

const participant = {
  statusKeseluruhan: StatusKeseluruhan.SELESAI,
  hasilAssessment: { status: StatusAssessment.HADIR },
  pengumuman: { statusAkhir: StatusPengumuman.DITERIMA },
  statusGrupWa: { status: StatusUndanganWa.SUDAH_DIUNDANG },
  pembayaran: [
    { jenis: JenisPembayaran.DU, status: StatusPembayaran.VERIFIED, nominal: 2_500_000, verifiedAt: new Date() },
    { jenis: JenisPembayaran.PENDAFTARAN, status: StatusPembayaran.VERIFIED, nominal: 500_000, verifiedAt: new Date() },
    { jenis: JenisPembayaran.PENDAFTARAN, status: StatusPembayaran.REJECTED, nominal: 500_000, verifiedAt: null },
  ],
};

describe("reporting operational filters", () => {
  it("menganggap tahap setelah submit sebagai enrollment lengkap", () => {
    expect(enrollmentStatus(StatusKeseluruhan.ENROLLMENT)).toBe("BELUM_LENGKAP");
    expect(enrollmentStatus(StatusKeseluruhan.MENUNGGU_ASESMEN)).toBe("LENGKAP");
  });

  it("mencocokkan filter gabungan lintas tahap", () => {
    expect(matchesOperationalFilters(participant, {
      statusPembayaran: StatusPembayaran.VERIFIED,
      statusEnrollment: "LENGKAP",
      statusAssessment: StatusAssessment.HADIR,
      statusKelulusan: StatusPengumuman.DITERIMA,
      statusDu: StatusPembayaran.VERIFIED,
      statusWa: StatusUndanganWa.SUDAH_DIUNDANG,
    })).toBe(true);
  });

  it("menggunakan transaksi terbaru per jenis pembayaran", () => {
    expect(matchesOperationalFilters(participant, { statusPembayaran: StatusPembayaran.REJECTED })).toBe(false);
    expect(matchesOperationalFilters(participant, { statusPembayaran: StatusPembayaran.VERIFIED })).toBe(true);
  });

  it("memperlakukan relasi tahap yang belum ada sebagai status awal", () => {
    const initial = { ...participant, hasilAssessment: null, pengumuman: null, statusGrupWa: null, pembayaran: [] };
    expect(matchesOperationalFilters(initial, {
      statusAssessment: StatusAssessment.BELUM,
      statusKelulusan: "MENUNGGU",
      statusDu: "BELUM_ADA",
      statusWa: "BELUM_ADA",
    })).toBe(true);
  });
});
