import { describe, expect, it } from "vitest";

import { StatusKeseluruhan, StatusPengumuman } from "@/generated/prisma/enums";
import {
  isAnnouncementReleased,
  googleCalendarReminderUrl,
  jakartaDateString,
  mayViewAnnouncement,
  mayViewAssessment,
  releasedOverallStatus,
  stageContentSlug,
  youtubeVideoId,
} from "@/lib/stages/rules";

describe("Phase 7 stage rules", () => {
  it("menggunakan tanggal kalender Asia/Jakarta", () => {
    expect(jakartaDateString(new Date("2026-08-29T17:00:00.000Z"))).toBe("2026-08-30");
  });

  it("merilis pada hari rilis dan setelahnya, bukan sebelumnya", () => {
    const release = new Date("2026-09-10T00:00:00.000Z");
    expect(isAnnouncementReleased(release, "2026-09-09")).toBe(false);
    expect(isAnnouncementReleased(release, "2026-09-10")).toBe(true);
    expect(isAnnouncementReleased(release, "2026-09-11")).toBe(true);
    expect(isAnnouncementReleased(null, "2026-09-11")).toBe(false);
  });

  it("memetakan keputusan rilis ke status keseluruhan", () => {
    expect(releasedOverallStatus(StatusPengumuman.DITERIMA)).toBe(StatusKeseluruhan.DITERIMA);
    expect(releasedOverallStatus(StatusPengumuman.TIDAK_DITERIMA)).toBe(StatusKeseluruhan.TIDAK_DITERIMA);
  });

  it("menerapkan gate tahap wali", () => {
    expect(mayViewAssessment(StatusKeseluruhan.ENROLLMENT)).toBe(false);
    expect(mayViewAssessment(StatusKeseluruhan.MENUNGGU_ASESMEN)).toBe(true);
    expect(mayViewAnnouncement(StatusKeseluruhan.MENUNGGU_ASESMEN)).toBe(false);
    expect(mayViewAnnouncement(StatusKeseluruhan.MENUNGGU_PENGUMUMAN)).toBe(true);
    expect(mayViewAnnouncement(StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK)).toBe(true);
  });

  it("membentuk slug CMS untuk tahap bertanda underscore", () => {
    expect(stageContentSlug("HOME")).toBe("beranda");
    expect(stageContentSlug("ADMISSION_FEE")).toBe("admission-fee");
    expect(stageContentSlug("JOIN_WA")).toBe("join-wa");
  });

  it("mengekstrak ID dari format link YouTube yang didukung", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=12")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("membentuk event Google Calendar all-day dari tanggal dan catatan admin", () => {
    const calendar = new URL(googleCalendarReminderUrl({
      title: "Assessment SPMB — Ahmad",
      date: "2026-09-30",
      details: "Datang pukul 08.00 dan membawa alat tulis.",
    }));
    expect(calendar.origin).toBe("https://calendar.google.com");
    expect(calendar.searchParams.get("action")).toBe("TEMPLATE");
    expect(calendar.searchParams.get("dates")).toBe("20260930/20261001");
    expect(calendar.searchParams.get("details")).toContain("membawa alat tulis");
  });
});
