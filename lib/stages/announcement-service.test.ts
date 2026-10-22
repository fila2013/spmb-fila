import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  calonMurid: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  kontenTahap: { findMany: vi.fn() },
  pengumuman: { upsert: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
const templates = vi.hoisted(() => vi.fn());
const filterContent = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/stages/announcement-template-service", () => ({ getAnnouncementTemplates: templates }));
vi.mock("@/lib/stages/participant-order", () => ({ contentVisibleToParticipant: filterContent }));

import { StatusAssessment, StatusKeseluruhan, StatusPengumuman, TahapKonten } from "@/generated/prisma/enums";
import { defaultAnnouncementTemplates } from "@/lib/stages/announcement-letter";
import { getAnnouncementForWali, updateAnnouncement } from "@/lib/stages/service";

function participant(statusAkhir: StatusPengumuman = StatusPengumuman.DITERIMA, date = "2026-10-24") {
  return {
    id: "child-1", userId: "wali-1", namaAnak: "Randa Admiral", createdAt: new Date("2026-10-03"),
    statusKeseluruhan: StatusKeseluruhan.MENUNGGU_PENGUMUMAN as StatusKeseluruhan,
    jalurId: "route-1", kategoriId: "category-1", menungguFallbackJalurId: null,
    pilihanJalurFinal: null, pilihanJalurFinalAt: null, jalurAsal: null, menungguFallbackJalur: null,
    jalur: { id: "route-1", nama: "Reguler", pilihanJalurFinalAktif: false, pilihanJalurFinalTargetId: null as string | null, pilihanJalurFinalTarget: null, hapusDataJikaGagal: true, fallbackJalurId: "legacy-fallback" },
    kategori: { id: "category-1", nama: "Eksternal/Umum" },
    hasilAssessment: { status: StatusAssessment.HADIR },
    pengumuman: { statusAkhir, tanggalRilis: new Date(`${date}T00:00:00.000Z`) },
  };
}

describe("alur pengumuman dan keputusan final", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T06:00:00.000Z"));
    database.$transaction.mockImplementation((work) => work(database));
    templates.mockResolvedValue(defaultAnnouncementTemplates);
    filterContent.mockImplementation((blocks) => blocks);
    database.kontenTahap.findMany.mockResolvedValue([{ id: "info-1", judul: "Jadwal pengumuman", tanggal: new Date("2026-10-24"), isiTeks: "Informasi dari panitia", gambarUrl: "https://example.com/info.webp", youtubeVideoId: null, urutanLayout: 0 }]);
  });
  afterEach(() => vi.useRealTimers());

  it.each([StatusPengumuman.DITERIMA, StatusPengumuman.TIDAK_DITERIMA])("sebelum rilis menampilkan blok tetapi menyembunyikan hasil %s dan surat", async (status) => {
    database.calonMurid.findUnique.mockResolvedValue(participant(status));
    const data = await getAnnouncementForWali("child-1", "wali-1");
    expect(data).toMatchObject({ released: false, statusAkhir: null, letter: null, canContinueToAdmission: false, finalRouteChoice: null });
    expect(data.content[0]).toMatchObject({ isiTeks: "Informasi dari panitia", tanggal: "2026-10-24", gambarUrl: "https://example.com/info.webp" });
    expect(filterContent).toHaveBeenCalledWith(expect.any(Array), expect.any(Object), TahapKonten.ANNOUNCEMENT);
    expect(templates).not.toHaveBeenCalled();
    expect(database.calonMurid.update).not.toHaveBeenCalled();
  });

  it.each([StatusPengumuman.DITERIMA, StatusPengumuman.TIDAK_DITERIMA])("merilis surat %s tepat pada pergantian tanggal Jakarta", async (status) => {
    vi.setSystemTime(new Date("2026-10-23T17:00:00.000Z"));
    const child = participant(status);
    database.calonMurid.findUnique.mockImplementation(async () => ({ ...child }));
    database.calonMurid.update.mockImplementation(async ({ data }) => Object.assign(child, data));
    const data = await getAnnouncementForWali(child.id, child.userId);
    expect(data.released).toBe(true);
    expect(data.statusAkhir).toBe(status);
    expect(data.letter).toContain("Nama Peserta: Randa Admiral");
    expect(data.letter).toContain("Jalur Pendaftaran: Reguler");
    expect(data.canContinueToAdmission).toBe(status === StatusPengumuman.DITERIMA);
    expect(data.content).toEqual([]);
    expect(database.calonMurid.delete).not.toHaveBeenCalled();
    expect(child.statusKeseluruhan).toBe(status === StatusPengumuman.DITERIMA ? StatusKeseluruhan.DITERIMA : StatusKeseluruhan.TIDAK_DITERIMA);
  });

  it("menahan DU sampai pilihan jalur final peserta diterima selesai", async () => {
    const child = participant(StatusPengumuman.DITERIMA, "2026-10-22");
    child.jalur.pilihanJalurFinalAktif = true;
    child.jalur.pilihanJalurFinalTargetId = "target-1";
    database.calonMurid.findUnique.mockImplementation(async () => ({ ...child }));
    database.calonMurid.update.mockImplementation(async ({ data }) => Object.assign(child, data));
    const data = await getAnnouncementForWali(child.id, child.userId);
    expect(data.canContinueToAdmission).toBe(false);
    expect(data.finalRouteChoice?.required).toBe(true);
  });

  it("menolak akses surat dan konten anak milik wali lain", async () => {
    database.calonMurid.findUnique.mockResolvedValue(participant());
    await expect(getAnnouncementForWali("child-1", "wali-lain")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(templates).not.toHaveBeenCalled();
  });

  it.each(["2026-10-22", "2026-10-24"])("menyimpan penolakan %s tanpa fallback atau hapus walau flag lama aktif", async (date) => {
    database.calonMurid.findUnique.mockResolvedValue(participant());
    database.pengumuman.upsert.mockImplementation(async ({ create }) => create);
    const result = await updateAnnouncement("child-1", { statusAkhir: StatusPengumuman.TIDAK_DITERIMA, tanggalRilis: date }, "admin-1");
    expect(result).toMatchObject({ deleted: false, effect: { type: "NONE" }, statusAkhir: StatusPengumuman.TIDAK_DITERIMA });
    expect(database.calonMurid.update).toHaveBeenCalledWith({ where: { id: "child-1" }, data: { statusKeseluruhan: date === "2026-10-22" ? StatusKeseluruhan.TIDAK_DITERIMA : StatusKeseluruhan.MENUNGGU_PENGUMUMAN } });
    expect(database.calonMurid.delete).not.toHaveBeenCalled();
  });

  it("mengunci perubahan hasil setelah DU dimulai", async () => {
    database.calonMurid.findUnique.mockResolvedValue({ ...participant(), statusKeseluruhan: StatusKeseluruhan.MENUNGGU_DU });
    await expect(updateAnnouncement("child-1", { statusAkhir: StatusPengumuman.TIDAK_DITERIMA, tanggalRilis: "2026-10-22" }, "admin-1")).rejects.toMatchObject({ code: "INVALID_STAGE" });
    expect(database.pengumuman.upsert).not.toHaveBeenCalled();
  });
});
