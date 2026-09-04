import { describe, expect, it } from "vitest";

import { StatusKeseluruhan, StatusPengumuman } from "@/generated/prisma/enums";
import {
  isAnnouncementReleased,
  jakartaDateString,
  mayViewAnnouncement,
  mayViewAssessment,
  releasedOverallStatus,
  stageContentSlug,
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
});
