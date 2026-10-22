import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  calonMurid: { findUnique: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  pembayaran: { findFirst: vi.fn() },
  kontenTahap: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  statusGrupWa: { update: vi.fn(), upsert: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { StatusKeseluruhan, StatusUndanganWa, TahapKonten } from "@/generated/prisma/enums";
import { confirmWhatsappMembership, getAdmissionFeePageData, getJoinWaPageData, openWhatsappInvitation } from "@/lib/admission/service";
import { stageContentInputSchema } from "@/lib/stages/schemas";
import { createStageContent, updateStageContent } from "@/lib/stages/service";

const input = stageContentInputSchema.parse({ tahap: TahapKonten.ADMISSION_FEE, judul: "Informasi DU", judulTutorial: "Cara Pembayaran DU", youtubeVideoId: "https://youtu.be/dQw4w9WgXcQ", tanggal: "", isiTeks: "Petunjuk pembayaran", urutanLayout: 0, statusAktif: true, jalurId: "", kategoriId: "" });
const child = { id: "child-1", userId: "wali-1", namaAnak: "Anak Uji", jalurId: "route-1", kategoriId: "category-1", createdAt: new Date("2026-10-01"), menungguFallbackJalurId: null, statusKeseluruhan: StatusKeseluruhan.MENUNGGU_JOIN_WA, statusGrupWa: { linkUndangan: "https://chat.whatsapp.com/Legacy_Manual", linkDitetapkanAt: new Date(), linkDibukaAt: null } };
const joinBlock = { ...input, id: "join-1", tahap: TahapKonten.JOIN_WA, isiTeks: "Selamat datang. Buka https://chat.whatsapp.com/Test_Group?mode=invite", youtubeVideoId: null, judulTutorial: null, gambarUrl: "https://example.com/info.webp", tanggal: null };

describe("konten tutorial DU dan link WA pemilik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.$transaction.mockImplementation((work) => work(database));
    database.calonMurid.findUnique.mockResolvedValue(child);
    database.kontenTahap.findMany.mockResolvedValue([joinBlock]);
    database.pembayaran.findFirst.mockResolvedValue({ id: "du-verified" });
    database.calonMurid.count.mockResolvedValue(2);
    database.calonMurid.updateMany.mockResolvedValue({ count: 1 });
    database.statusGrupWa.update.mockImplementation(async ({ data }) => data);
  });

  it("menyimpan create/edit judul dan ID video serta meneruskannya ke halaman DU", async () => {
    const saved = { ...input, id: "block-1", tanggal: null };
    database.kontenTahap.create.mockResolvedValue(saved);
    database.kontenTahap.findUnique.mockResolvedValue(saved);
    database.kontenTahap.update.mockResolvedValue({ ...saved, judulTutorial: "Tutorial baru" });
    await createStageContent(input, "admin-1");
    expect(database.kontenTahap.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ judulTutorial: "Cara Pembayaran DU", youtubeVideoId: "dQw4w9WgXcQ" }) }));
    const updated = await updateStageContent({ ...input, id: saved.id, judulTutorial: "Tutorial baru" }, "admin-1");
    expect(updated.judulTutorial).toBe("Tutorial baru");
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusKeseluruhan: StatusKeseluruhan.DITERIMA });
    database.pembayaran.findFirst.mockResolvedValue(null);
    database.kontenTahap.findMany.mockResolvedValue([updated]);
    const page = await getAdmissionFeePageData(child.id, child.userId);
    expect(page.content[0]).toMatchObject({ judulTutorial: "Tutorial baru", youtubeVideoId: "dQw4w9WgXcQ" });
  });

  it("membatasi tutorial ke DU dan menolak URL video di tahap lain", async () => {
    expect(stageContentInputSchema.safeParse({ ...input, youtubeVideoId: "https://evil.example/video" }).success).toBe(false);
    expect(stageContentInputSchema.parse({ ...input, judulTutorial: "", youtubeVideoId: "" })).toMatchObject({ judulTutorial: null, youtubeVideoId: null });
    await expect(createStageContent({ ...input, tahap: TahapKonten.ASSESSMENT }, "admin-1")).rejects.toMatchObject({ code: "INVALID_VIDEO_SCOPE" });
  });

  it("menampilkan link grup resmi yang dinormalisasi hanya setelah DU verified", async () => {
    const page = await getJoinWaPageData(child.id, child.userId);
    expect(page.inviteUrl).toBe("https://chat.whatsapp.com/Test_Group");
    expect(page.inviteUrls).not.toContain(child.statusGrupWa.linkUndangan);
    expect(page.content[0].gambarUrl).toBe(joinBlock.gambarUrl);
    expect(database.kontenTahap.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tahap: TahapKonten.JOIN_WA, statusAktif: true, AND: [
      { OR: [{ jalurId: null }, { jalurId: child.jalurId }] },
      { OR: [{ kategoriId: null }, { kategoriId: child.kategoriId }] },
    ] }) }));
    database.pembayaran.findFirst.mockResolvedValue(null);
    await expect(getJoinWaPageData(child.id, child.userId)).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });

  it("menolak kebocoran antarwali dan mengabaikan link manual lama meski tidak valid", async () => {
    await expect(getJoinWaPageData(child.id, "wali-lain")).rejects.toMatchObject({ code: "FORBIDDEN" });
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: { ...child.statusGrupWa, linkUndangan: "javascript:alert(1)" } });
    expect((await getJoinWaPageData(child.id, child.userId)).inviteUrl).toBe("https://chat.whatsapp.com/Test_Group");
  });

  it("tetap mencatat pembukaan sebelum konfirmasi dan tidak menduplikasi catatan klik", async () => {
    expect(await openWhatsappInvitation(child.id, child.userId)).toBe("https://chat.whatsapp.com/Test_Group");
    expect(database.statusGrupWa.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ linkUndangan: "https://chat.whatsapp.com/Test_Group", linkDibukaAt: expect.any(Date) }) }));
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: { ...child.statusGrupWa, linkUndangan: "https://chat.whatsapp.com/Test_Group", linkDibukaAt: new Date() } });
    await openWhatsappInvitation(child.id, child.userId);
    expect(database.statusGrupWa.upsert).toHaveBeenCalledOnce();
  });

  it("membuat snapshot klik tanpa perlu baris undangan manual sebelumnya", async () => {
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: null });
    await openWhatsappInvitation(child.id, child.userId);
    expect(database.statusGrupWa.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ calonMuridId: child.id, linkUndangan: "https://chat.whatsapp.com/Test_Group", linkDitetapkanAt: expect.any(Date), linkDibukaAt: expect.any(Date) }) }));
    const { create } = database.statusGrupWa.upsert.mock.calls[0][0];
    expect(create.linkDibukaAt.getTime()).toBeGreaterThanOrEqual(create.linkDitetapkanAt.getTime());
  });

  it("tetap membuka link pusat terbaru setelah selesai tanpa menimpa kronologi konfirmasi historis", async () => {
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusKeseluruhan: StatusKeseluruhan.SELESAI, statusGrupWa: { ...child.statusGrupWa, status: StatusUndanganWa.SUDAH_DIUNDANG, linkDibukaAt: new Date("2026-10-01"), dikonfirmasiWaliAt: new Date("2026-10-02") } });
    expect(await openWhatsappInvitation(child.id, child.userId)).toBe("https://chat.whatsapp.com/Test_Group");
    expect(database.statusGrupWa.upsert).not.toHaveBeenCalled();
    expect(database.statusGrupWa.update).not.toHaveBeenCalled();
    expect((await confirmWhatsappMembership(child.id, child.userId)).nextStatus).toBe(StatusKeseluruhan.SELESAI);
    expect(database.calonMurid.updateMany).not.toHaveBeenCalled();
  });

  it("tanpa blok aktif yang cocok tidak kembali memakai undangan manual", async () => {
    database.kontenTahap.findMany.mockResolvedValue([]);
    expect((await getJoinWaPageData(child.id, child.userId)).inviteUrls).toEqual([]);
    await expect(openWhatsappInvitation(child.id, child.userId)).rejects.toMatchObject({ code: "INVITE_LINK_PENDING" });
    expect(database.statusGrupWa.upsert).not.toHaveBeenCalled();
  });

  it("menerapkan rentang urutan pada link pusat ketika membaca maupun membuka", async () => {
    database.kontenTahap.findMany.mockResolvedValue([
      { ...joinBlock, minParticipantOrder: 1, maxParticipantOrder: 1 },
      { ...joinBlock, id: "join-2", isiTeks: "https://chat.whatsapp.com/Range_2", minParticipantOrder: 2, maxParticipantOrder: 5 },
    ]);
    expect((await getJoinWaPageData(child.id, child.userId)).inviteUrls).toEqual(["https://chat.whatsapp.com/Range_2"]);
    await expect(openWhatsappInvitation(child.id, child.userId, "https://chat.whatsapp.com/Test_Group")).rejects.toMatchObject({ code: "INVITE_LINK_CHANGED" });
    expect(await openWhatsappInvitation(child.id, child.userId, "https://chat.whatsapp.com/Range_2")).toBe("https://chat.whatsapp.com/Range_2");
  });

  it("otomatis mengikuti edit CMS dan menolak konfirmasi dengan snapshot link yang sudah berubah", async () => {
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: { ...child.statusGrupWa, linkUndangan: "https://chat.whatsapp.com/Test_Group", linkDibukaAt: new Date() } });
    database.kontenTahap.findMany.mockResolvedValue([{ ...joinBlock, isiTeks: "https://chat.whatsapp.com/New_Group" }]);
    const page = await getJoinWaPageData(child.id, child.userId);
    expect(page.inviteUrls).toEqual(["https://chat.whatsapp.com/New_Group"]);
    expect(page.linkOpenedAt).toBeNull();
    await expect(confirmWhatsappMembership(child.id, child.userId)).rejects.toMatchObject({ code: "INVITE_LINK_CHANGED" });
    expect(database.calonMurid.updateMany).not.toHaveBeenCalled();
  });

  it("tetap memerlukan klik link pusat sebelum konfirmasi dan menerima snapshot yang masih berlaku", async () => {
    await expect(confirmWhatsappMembership(child.id, child.userId)).rejects.toMatchObject({ code: "INVITE_LINK_NOT_OPENED" });
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: { ...child.statusGrupWa, linkUndangan: "https://chat.whatsapp.com/Test_Group", linkDibukaAt: new Date() } });
    expect((await confirmWhatsappMembership(child.id, child.userId)).nextStatus).toBe(StatusKeseluruhan.SELESAI);
  });
});
