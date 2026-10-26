import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: vi.fn(), select: vi.fn(), birth: vi.fn(), create: vi.fn(), refresh: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/calon-murid/service", () => ({ selectKategori: mocks.select, updateBirthDetails: mocks.birth, createCalonMuridWithJalur: mocks.create }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { selectCategoryAction, updateBirthDetailsAction } from "@/app/anak/actions";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { PaymentError } from "@/lib/payment/errors";
import { AuthorizationError } from "@/lib/auth/errors";

const id = "10000000-0000-4000-8000-000000000001";
function payload() { const data = new FormData(); data.set("calonMuridId", id); data.set("kategoriId", id); return data; }

describe("diagnostik action pendaftaran", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role.mockResolvedValue({ userId: "wali-1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mengirim pesan Zod spesifik dan seluruh flatten tanpa memanggil backend", async () => {
    const data = payload(); data.delete("kategoriId"); data.set("subKategoriText", "x".repeat(151));
    const result = await selectCategoryAction({ status: "idle" }, data);
    expect(result.message).toContain("Pilih kategori pendaftar terlebih dahulu");
    expect(result.fieldErrors?.subKategoriText).toEqual(["Nama asal TK maksimal 150 karakter."]);
    expect(console.error).toHaveBeenCalledWith("DEBUG selectCategoryAction ERROR:", expect.objectContaining({ validation: { formErrors: [], fieldErrors: result.fieldErrors } }));
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each([
    new CalonMuridError("INVALID_STAGE", "Nama asal TK wajib diisi minimal 2 karakter.", 422),
    new CalonMuridError("BIRTH_DETAILS_REQUIRED", "Data lahir belum tersimpan.", 422),
    new PaymentError("HOLD_EXPIRED", "Hold kuota pembayaran sudah berakhir.", 409),
    new AuthorizationError("UNAUTHENTICATED", "Silakan masuk kembali."),
  ])("meneruskan error domain aman: $code", async (error) => {
    mocks.select.mockRejectedValue(error);
    expect((await selectCategoryAction({ status: "idle" }, payload())).message).toBe(error.message);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("DEBUG selectCategoryAction ERROR:", expect.objectContaining({ code: error.code }));
  });

  it("menjelaskan timeout tanpa membocorkan query, credential atau input dari error Prisma", async () => {
    const error = Object.assign(new Error("postgresql://secret:password@db.test Nama Anak Pribadi"), { code: "P2028" });
    mocks.select.mockRejectedValue(error);
    const result = await selectCategoryAction({ status: "idle" }, payload());
    expect(result.message).toContain("P2028");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("password");
    expect(JSON.stringify(result)).not.toContain("Nama Anak Pribadi");
  });

  it("validasi tanggal tetap spesifik sebelum disimpan", async () => {
    const data = payload(); data.set("tempatLahir", "Bandar Lampung"); data.set("tanggalLahir", "2021-02-30");
    expect((await updateBirthDetailsAction({ status: "idle" }, data)).message).toContain("tanggal lahir yang valid");
    expect(mocks.birth).not.toHaveBeenCalled();
  });

  it("redirect sukses berada di luar catch dan memakai identitas session", async () => {
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    await expect(selectCategoryAction({ status: "idle" }, payload())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.select).toHaveBeenCalledWith(id, expect.objectContaining({ kategoriId: id }), "wali-1");
    expect(console.error).not.toHaveBeenCalled();
  });
});
