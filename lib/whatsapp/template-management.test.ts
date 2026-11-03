import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  templatePesanWhatsapp: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const auth = vi.hoisted(() => ({ requireRole: vi.fn() }));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth/session", () => auth);
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveWhatsappTemplateAction } from "@/app/admin/konten/kirim-wa/actions";
import { UserRole } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { whatsappTemplateSchema } from "@/lib/whatsapp/template-schema";
import { listActiveWhatsappTemplates, listWhatsappTemplates } from "@/lib/whatsapp/template-service";
import { WHATSAPP_TEMPLATE_BODY_MAX } from "@/lib/whatsapp/templates";

const id = "a8b40729-be0f-412c-8d9c-16799ca88c25";
const template = {
  judul: "Pengingat",
  kategori: "PENGINGAT_PEMBAYARAN",
  isiPesan: "Halo {nama_wali}, status {nama_peserta} adalah {status}.\nJalur {jalur}, kategori {kategori}.",
  statusAktif: true,
} as const;

function formData(values: Record<string, string> = {}) {
  const form = new FormData();
  const defaults = { judul: template.judul, kategori: template.kategori, isiPesan: template.isiPesan, statusAktif: "on" };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) form.set(key, value);
  return form;
}

describe("pengelolaan template WhatsApp", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.requireRole.mockResolvedValue({ userId: "admin-1" });
    db.$transaction.mockImplementation((work) => work(db));
  });

  it("memvalidasi judul dan pesan, menormalkan spasi luar, dan mempertahankan semua variabel", () => {
    expect(whatsappTemplateSchema.parse({ ...template, judul: "  Pengingat ", isiPesan: ` ${template.isiPesan} ` })).toEqual(template);
  });

  it.each(["{salah_eja}", "{nama_peserta", "{", " ", "a\0b", "x".repeat(WHATSAPP_TEMPLATE_BODY_MAX + 1)])("menolak isi yang tidak valid: %s", (isiPesan) => {
    expect(whatsappTemplateSchema.safeParse({ ...template, isiPesan }).success).toBe(false);
  });

  it("menolak non-Admin sebelum membuka transaksi", async () => {
    auth.requireRole.mockRejectedValue(new AuthorizationError("FORBIDDEN", "Wali tidak boleh mengubah template."));
    const result = await saveWhatsappTemplateAction({ status: "idle" }, formData());
    expect(auth.requireRole).toHaveBeenCalledWith(UserRole.ADMIN);
    expect(result).toMatchObject({ status: "error", message: "Akses Admin diperlukan untuk menyimpan template WhatsApp." });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("mengembalikan validasi field kategori dan isi tanpa menulis DB", async () => {
    const result = await saveWhatsappTemplateAction({ status: "idle" }, formData({ kategori: "invalid", isiPesan: "{nama_anak}" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { kategori: expect.any(Array), isiPesan: expect.any(Array) } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("membuat template dan audit terbatas dalam satu transaksi serta menyegarkan kedua halaman", async () => {
    db.templatePesanWhatsapp.create.mockResolvedValue({ id, ...template });
    const result = await saveWhatsappTemplateAction({ status: "idle" }, formData({ updatedById: "ignored" }));
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.templatePesanWhatsapp.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ...template, updatedById: "admin-1" } }));
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: {
      actorId: "admin-1", action: "CREATE_WHATSAPP_TEMPLATE", entity: "template_pesan_whatsapp", entityId: id,
      detail: { kategori: template.kategori, statusAktif: true },
    } });
    expect(result).toMatchObject({ status: "success", template: { id, ...template } });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/konten/kirim-wa");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/peserta");
  });

  it("mengedit dan menonaktifkan template, sedangkan daftar kirim hanya mengambil template aktif", async () => {
    db.templatePesanWhatsapp.update.mockResolvedValue({ id, ...template, statusAktif: false });
    const edit = formData({ id });
    edit.delete("statusAktif");
    expect(await saveWhatsappTemplateAction({ status: "idle" }, edit)).toMatchObject({ status: "success", template: { statusAktif: false } });
    expect(db.templatePesanWhatsapp.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id }, data: { ...template, statusAktif: false, updatedById: "admin-1" } }));
    expect(db.templatePesanWhatsapp.create).not.toHaveBeenCalled();

    db.templatePesanWhatsapp.findMany.mockResolvedValue([]);
    expect(await listActiveWhatsappTemplates()).toEqual([]);
    expect(db.templatePesanWhatsapp.findMany).toHaveBeenLastCalledWith({
      where: { statusAktif: true }, select: { id: true, judul: true, kategori: true, isiPesan: true },
      orderBy: [{ kategori: "asc" }, { judul: "asc" }, { id: "asc" }],
    });
    db.templatePesanWhatsapp.findMany.mockResolvedValue([{ id, ...template, statusAktif: false }]);
    expect(await listWhatsappTemplates()).toEqual([{ id, ...template, statusAktif: false }]);
  });

  it("menyembunyikan detail kegagalan DB dari UI", async () => {
    db.templatePesanWhatsapp.create.mockRejectedValue(new Error("private DB error"));
    const result = await saveWhatsappTemplateAction({ status: "idle" }, formData());
    expect(result).toMatchObject({ status: "error", message: "Template belum dapat disimpan. Silakan coba kembali." });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
