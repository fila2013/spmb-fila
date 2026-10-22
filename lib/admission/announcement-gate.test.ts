import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { calonMurid: { findUnique } } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: storage }));

import { getAdmissionFeePageData, uploadAdmissionFeeProof } from "@/lib/admission/service";

describe("penolakan seleksi mengunci DU di server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ id: "child-1", userId: "wali-1", statusKeseluruhan: "TIDAK_DITERIMA" });
  });

  it("menolak membuka halaman pembayaran DU", async () => {
    await expect(getAdmissionFeePageData("child-1", "wali-1")).rejects.toMatchObject({ code: "STAGE_FORBIDDEN", status: 403 });
    expect(storage).not.toHaveBeenCalled();
  });

  it("menolak unggahan bukti DU sebelum mengakses Storage", async () => {
    const file = new File(["%PDF-"], "bukti.pdf", { type: "application/pdf" });
    await expect(uploadAdmissionFeeProof("child-1", "wali-1", file)).rejects.toMatchObject({ code: "INVALID_STAGE", status: 409 });
    expect(storage).not.toHaveBeenCalled();
  });
});
