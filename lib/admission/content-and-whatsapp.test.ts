import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  calonMurid: { findUnique: vi.fn() },
  pembayaran: { findFirst: vi.fn() },
  kontenTahap: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  statusGrupWa: { update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { StatusKeseluruhan, TahapKonten } from "@/generated/prisma/enums";
import { getAdmissionFeePageData, getJoinWaPageData, openWhatsappInvitation } from "@/lib/admission/service";
import { stageContentInputSchema } from "@/lib/stages/schemas";
import { createStageContent, updateStageContent } from "@/lib/stages/service";

const input = stageContentInputSchema.parse({ tahap: TahapKonten.ADMISSION_FEE, judul: "Informasi DU", judulTutorial: "Cara Pembayaran DU", youtubeVideoId: "https://youtu.be/dQw4w9WgXcQ", tanggal: "", isiTeks: "Petunjuk pembayaran", urutanLayout: 0, statusAktif: true, jalurId: "", kategoriId: "" });
const child = { id: "child-1", userId: "wali-1", namaAnak: "Anak Uji", statusKeseluruhan: StatusKeseluruhan.MENUNGGU_JOIN_WA, statusGrupWa: { linkUndangan: "https://chat.whatsapp.com/Test_Group?mode=invite", linkDitetapkanAt: new Date(), linkDibukaAt: null } };

describe("konten tutorial DU dan link WA pemilik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.$transaction.mockImplementation((work) => work(database));
    database.calonMurid.findUnique.mockResolvedValue(child);
    database.kontenTahap.findMany.mockResolvedValue([]);
    database.pembayaran.findFirst.mockResolvedValue({ id: "du-verified" });
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
    database.pembayaran.findFirst.mockResolvedValue(null);
    await expect(getJoinWaPageData(child.id, child.userId)).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });

  it("menolak kebocoran link grup antarwali dan URL tersimpan yang tidak valid", async () => {
    await expect(getJoinWaPageData(child.id, "wali-lain")).rejects.toMatchObject({ code: "FORBIDDEN" });
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: { ...child.statusGrupWa, linkUndangan: "javascript:alert(1)" } });
    await expect(getJoinWaPageData(child.id, child.userId)).rejects.toMatchObject({ code: "INVALID_INVITE_LINK" });
  });

  it("tetap mencatat pembukaan sebelum konfirmasi dan tidak menduplikasi catatan klik", async () => {
    expect(await openWhatsappInvitation(child.id, child.userId)).toBe("https://chat.whatsapp.com/Test_Group");
    expect(database.statusGrupWa.update).toHaveBeenCalledWith(expect.objectContaining({ data: { linkDibukaAt: expect.any(Date) } }));
    database.calonMurid.findUnique.mockResolvedValue({ ...child, statusGrupWa: { ...child.statusGrupWa, linkDibukaAt: new Date() } });
    await openWhatsappInvitation(child.id, child.userId);
    expect(database.statusGrupWa.update).toHaveBeenCalledOnce();
  });
});
