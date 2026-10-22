import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  templateSuratPengumuman: { findUnique: vi.fn(), upsert: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { defaultAnnouncementTemplates } from "@/lib/stages/announcement-letter";
import { getAnnouncementTemplates, saveAnnouncementTemplates } from "@/lib/stages/announcement-template-service";

describe("penyimpanan master surat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.$transaction.mockImplementation((work) => work(database));
  });

  it("menyediakan teks resmi bawaan tanpa menulis database saat dibaca", async () => {
    database.templateSuratPengumuman.findUnique.mockResolvedValue(null);
    expect(await getAnnouncementTemplates()).toEqual(defaultAnnouncementTemplates);
    expect(database.templateSuratPengumuman.upsert).not.toHaveBeenCalled();
  });

  it("menyimpan kedua template dan audit dalam satu transaksi, lalu memuat data terbaru", async () => {
    const templates = { diterima: "Selamat {nama_peserta}, {status_keputusan} di {jalur}.", tidakDiterima: "Yth. {nama_peserta}, hasil: {status_keputusan}." };
    database.templateSuratPengumuman.upsert.mockResolvedValue(templates);
    database.templateSuratPengumuman.findUnique.mockResolvedValue(templates);
    expect(await saveAnnouncementTemplates(templates, "admin-1")).toEqual(templates);
    expect(database.templateSuratPengumuman.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "utama" }, update: { ...templates, updatedById: "admin-1" },
    }));
    expect(database.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "admin-1", action: "UPDATE_ANNOUNCEMENT_TEMPLATES" }) });
    expect(await getAnnouncementTemplates()).toEqual(templates);
  });

  it("menolak input tidak valid sebelum transaksi dimulai", async () => {
    await expect(saveAnnouncementTemplates({ diterima: "", tidakDiterima: "Surat" }, "admin-1")).rejects.toThrow();
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
