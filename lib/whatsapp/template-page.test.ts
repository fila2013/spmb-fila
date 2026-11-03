import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/navigation", () => ({ requireRolePage: guard }));
vi.mock("@/lib/whatsapp/template-service", () => ({ listWhatsappTemplates: list }));
vi.mock("@/app/admin/konten/kirim-wa/actions", () => ({ saveWhatsappTemplateAction: vi.fn() }));
vi.mock("@/components/admin/admin-logout-form", () => ({ AdminLogoutForm: () => null }));

import WhatsappTemplatesPage from "@/app/admin/konten/kirim-wa/page";
import { UserRole } from "@/generated/prisma/enums";

describe("halaman pengelolaan template WhatsApp", () => {
  beforeEach(() => vi.resetAllMocks());

  it("menampilkan menu aktif tepat setelah Konten Join WhatsApp serta opsi pengelolaan", async () => {
    guard.mockResolvedValue({ email: "admin@example.test" });
    list.mockResolvedValue([{ id: "test", judul: "Template uji", kategori: "INFORMASI_UMUM", isiPesan: "Halo {nama_wali}.", statusAktif: false }]);
    const html = renderToStaticMarkup(await WhatsappTemplatesPage());
    expect(guard).toHaveBeenCalledWith(UserRole.ADMIN);
    expect(html).toMatch(/Konten Join WhatsApp<\/a><a [^>]*aria-current="page"[^>]*href="\/admin\/konten\/kirim-wa"[^>]*>Konten Kirim WhatsApp<\/a>/);
    expect(html).toContain("Tambah template");
    expect(html).toContain("{nama_peserta}");
    expect(html).toContain("{nama_wali}");
    expect(html).toContain("Template uji");
    expect(html).toContain("Informasi Umum · Nonaktif");
  });

  it("tidak membaca template jika guard menolak akses", async () => {
    guard.mockRejectedValue(new Error("forbidden"));
    await expect(WhatsappTemplatesPage()).rejects.toThrow("forbidden");
    expect(list).not.toHaveBeenCalled();
  });
});
