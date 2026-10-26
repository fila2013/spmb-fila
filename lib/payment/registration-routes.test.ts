import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: vi.fn(), upload: vi.fn(), snap: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/payment/service", () => ({ uploadManualRegistrationProof: mocks.upload, createRegistrationSnapPayment: mocks.snap }));
vi.mock("@/lib/env/server", () => ({ getMidtransEnvironment: () => ({ MIDTRANS_IS_PRODUCTION: false }) }));

import { POST as manual } from "@/app/api/calon-murid/[id]/pembayaran/manual/route";
import { POST as midtrans } from "@/app/api/calon-murid/[id]/pembayaran/midtrans/create/route";
import { PaymentError } from "@/lib/payment/errors";
import { AuthorizationError } from "@/lib/auth/errors";
import { UserRole } from "@/generated/prisma/enums";

const params = Promise.resolve({ id: "10000000-0000-4000-8000-000000000001" });
function request() { const body = new FormData(); body.set("bukti", new File(["test"], "bukti.jpg", { type: "image/jpeg" })); return new Request("https://example.test/manual", { method: "POST", body }); }

describe("API pembayaran: diagnostik dan kontrak UI", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.role.mockResolvedValue({ userId: "wali-1" }); vi.spyOn(console, "error").mockImplementation(() => {}); });

  it.each([manual, midtrans])("meneruskan kode expired dan mencetak detail pada endpoint %s", async (handler) => {
    const error = new PaymentError("HOLD_EXPIRED", "Hold berakhir. Minta hold baru jika kuota masih ada.", 409);
    mocks.upload.mockRejectedValue(error); mocks.snap.mockRejectedValue(error);
    const response = await handler(request(), { params });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatchObject({ code: error.code, message: error.message });
    expect(console.error).toHaveBeenCalledWith("DEBUG Pembayaran ERROR:", expect.objectContaining({ code: error.code }));
    expect(mocks.role).toHaveBeenCalledWith(UserRole.WALI_MURID);
  });

  it("file wajib dan Zod ID invalid dilaporkan spesifik tanpa upload", async () => {
    const response = await manual(new Request("https://example.test/manual", { method: "POST", body: new FormData() }), { params });
    expect((await response.json()).error.message).toBe("Pilih bukti transfer.");
    const invalid = await manual(request(), { params: Promise.resolve({ id: "bad-id" }) });
    expect(invalid.status).toBe(422);
    expect(console.error).toHaveBeenCalledWith("DEBUG Pembayaran ERROR:", expect.objectContaining({ validation: expect.objectContaining({ formErrors: ["Pilihan tidak valid."] }) }));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("tetap menolak session tidak sah sebelum memproses file", async () => {
    mocks.role.mockRejectedValue(new AuthorizationError("UNAUTHENTICATED", "Silakan login."));
    expect((await manual(request(), { params })).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("membedakan hold hampir habis dari hold kedaluwarsa pada Midtrans", async () => {
    mocks.snap.mockRejectedValue(new PaymentError("HOLD_EXPIRING", "Tunggu timer berakhir sebelum meminta hold baru.", 409));
    const response = await midtrans(request(), { params });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("HOLD_EXPIRING");
  });
});
