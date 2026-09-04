import {
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";

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

export function releasedOverallStatus(status: StatusPengumuman) {
  return status === StatusPengumuman.DITERIMA
    ? StatusKeseluruhan.DITERIMA
    : StatusKeseluruhan.TIDAK_DITERIMA;
}

export function stageContentSlug(tahap: string) {
  if (tahap === "HOME") return "beranda";
  return tahap.toLowerCase().replaceAll("_", "-");
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
