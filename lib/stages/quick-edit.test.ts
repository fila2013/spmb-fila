import { describe, expect, it } from "vitest";

import { StatusAssessment, StatusKeseluruhan } from "@/generated/prisma/enums";
import { applyQuickEditResult, type QuickEditParticipant } from "@/lib/stages/quick-edit";

const participant: QuickEditParticipant = {
  id: "child-1",
  namaAnak: "Anak Satu",
  email: "wali@example.com",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  jalurKategori: "TCP / Umum",
  statusKeseluruhan: StatusKeseluruhan.MENUNGGU_ASESMEN,
  assessmentStatus: StatusAssessment.BELUM,
  assessmentNote: "",
  announcementStatus: null,
  releaseDate: "",
  announcementLocked: false,
  requiresDeleteConfirmation: false,
  finalRouteChoiceEnabled: false,
};

describe("applyQuickEditResult", () => {
  it("updates the visible status and assessment without navigation", () => {
    const rows = applyQuickEditResult([participant], participant.id, {
      nextStatus: StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
      assessment: { status: StatusAssessment.HADIR, catatan: "Hadir tepat waktu" },
    }, null);
    expect(rows[0]).toMatchObject({
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
      assessmentStatus: StatusAssessment.HADIR,
      assessmentNote: "Hadir tepat waktu",
    });
  });

  it("removes a row when its new status no longer matches the active filter", () => {
    expect(applyQuickEditResult([participant], participant.id, {
      nextStatus: StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
    }, StatusKeseluruhan.MENUNGGU_ASESMEN)).toEqual([]);
  });

  it("removes a participant deleted by an authorized rejection", () => {
    expect(applyQuickEditResult([participant], participant.id, {
      nextStatus: StatusKeseluruhan.TIDAK_DITERIMA,
      deleted: true,
    }, null)).toEqual([]);
  });

  it("locks an announcement when the final route choice is pending", () => {
    const rows = applyQuickEditResult([participant], participant.id, {
      nextStatus: StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR,
      announcement: { statusAkhir: "DITERIMA", tanggalRilis: "2026-10-02" },
    }, null);
    expect(rows[0]).toMatchObject({ announcementLocked: true, releaseDate: "2026-10-02" });
  });
});
