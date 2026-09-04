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

const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (youtubeVideoIdPattern.test(candidate)) return candidate;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;
    if (hostname === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "youtube-nocookie.com"
    ) {
      const segments = url.pathname.split("/").filter(Boolean);
      id = url.pathname === "/watch"
        ? url.searchParams.get("v")
        : ["embed", "shorts", "live"].includes(segments[0] ?? "")
          ? segments[1] ?? null
          : null;
    }
    return id && youtubeVideoIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

function compactCalendarDate(date: string) {
  return date.replaceAll("-", "");
}

export function googleCalendarReminderUrl({
  title,
  date,
  details,
}: {
  title: string;
  date: string;
  details?: string | null;
}) {
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${compactCalendarDate(date)}/${compactCalendarDate(end.toISOString().slice(0, 10))}`,
    details: details?.trim() || "Pengingat jadwal SPMB FILA.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
