import {
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";
import { StageError } from "@/lib/stages/errors";

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function jakartaDateString(now = new Date()) {
  return jakartaDateFormatter.format(now);
}

export function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function isAnnouncementReleased(
  releaseDate: Date | null,
  today = jakartaDateString(),
) {
  const value = dateOnly(releaseDate);
  return Boolean(value && value <= today);
}

export function assertAnnouncementDecisionSupported(
  status: StatusPengumuman,
  jalur: { fallbackJalurId: string | null; hapusDataJikaGagal: boolean },
) {
  if (
    status === StatusPengumuman.TIDAK_DITERIMA &&
    (jalur.fallbackJalurId || jalur.hapusDataJikaGagal)
  ) {
    throw new StageError(
      "PHASE8_REQUIRED",
      "Keputusan gagal untuk jalur ini harus diproses bersama fallback atau konfirmasi penghapusan pada Phase 8.",
      409,
    );
  }
}

export function releasedOverallStatus(status: StatusPengumuman) {
  return status === StatusPengumuman.DITERIMA
    ? StatusKeseluruhan.DITERIMA
    : StatusKeseluruhan.TIDAK_DITERIMA;
}

export function mayViewAssessment(status: StatusKeseluruhan) {
  const blocked: StatusKeseluruhan[] = [
    StatusKeseluruhan.PILIH_JALUR,
    StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
    StatusKeseluruhan.ENROLLMENT,
  ];
  return !blocked.includes(status);
}

export function mayViewAnnouncement(status: StatusKeseluruhan) {
  const allowed: StatusKeseluruhan[] = [
    StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
    StatusKeseluruhan.DITERIMA,
    StatusKeseluruhan.TIDAK_DITERIMA,
    StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
    StatusKeseluruhan.MENUNGGU_DU,
    StatusKeseluruhan.MENUNGGU_JOIN_WA,
    StatusKeseluruhan.SELESAI,
  ];
  return allowed.includes(status);
}
