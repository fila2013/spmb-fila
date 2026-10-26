import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  owner: vi.fn(), eligible: vi.fn(), getHold: vi.fn(), requireHold: vi.fn(), verifyHold: vi.fn(),
  storage: { upload: vi.fn(), remove: vi.fn() },
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), calonMurid: { findUnique: vi.fn(), updateMany: vi.fn() }, pengaturanPembayaran: { findUnique: vi.fn() }, pembayaran: { findFirst: vi.fn(), create: vi.fn() }, biayaPendaftaran: { findFirst: vi.fn() }, auditLog: { create: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/calon-murid/service", () => ({ getOwnedCalonMurid: mocks.owner, assertBirthEligibility: mocks.eligible }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ storage: { from: () => mocks.storage } }) }));
vi.mock("@/lib/quota-hold/service", () => ({ getRegistrationQuotaHold: mocks.getHold, requireActiveRegistrationHoldInTransaction: mocks.requireHold, verifyRegistrationQuotaHoldInTransaction: mocks.verifyHold }));

import { uploadManualRegistrationProof } from "@/lib/payment/service";
import { PaymentError } from "@/lib/payment/errors";

const child = { id: "child-1", userId: "wali-1", jalurId: "route-1", kategoriId: "category-1", tempatLahir: "Lampung", tanggalLahir: new Date("2021-06-01"), statusKeseluruhan: "MENUNGGU_VERIFIKASI_BAYAR" };
const proof = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "bukti.jpg", { type: "image/jpeg" });

describe("unggah bukti manual dan expiry", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SUPABASE_STORAGE_BUCKET_PEMBAYARAN", "test-bucket");
    mocks.owner.mockResolvedValue(child);
    mocks.getHold.mockResolvedValue({ status: "PENDING_PAYMENT", expiresAt: new Date(Date.now() + 60000) });
    mocks.storage.upload.mockResolvedValue({ error: null }); mocks.storage.remove.mockResolvedValue({ error: null });
    mocks.db.$transaction.mockImplementation((work) => work(mocks.db));
    mocks.db.calonMurid.findUnique.mockResolvedValue(child);
    mocks.db.calonMurid.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.pengaturanPembayaran.findUnique.mockResolvedValue({ mode: "MANUAL" });
    mocks.db.biayaPendaftaran.findFirst.mockResolvedValue({ nominal: 300000 });
    mocks.db.pembayaran.create.mockResolvedValue({ id: "payment-1", status: "VERIFIED" });
  });

  it("menolak hold expired sebelum mengunggah object Storage", async () => {
    mocks.getHold.mockResolvedValue({ status: "PENDING_PAYMENT", expiresAt: new Date(Date.now() - 1) });
    await expect(uploadManualRegistrationProof(child.id, child.userId, proof())).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    expect(mocks.storage.upload).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("menjelaskan hold expired setelah cron mengembalikan tahap ke pilih jalur", async () => {
    mocks.owner.mockResolvedValue({ ...child, statusKeseluruhan: "PILIH_JALUR" });
    mocks.getHold.mockResolvedValue({ status: "EXPIRED", expiresAt: new Date(0) });
    await expect(uploadManualRegistrationProof(child.id, child.userId, proof())).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
  });

  it("jika expiry terjadi saat upload, transaction gagal dan bukti sementara dibersihkan", async () => {
    mocks.verifyHold.mockRejectedValue(new PaymentError("HOLD_EXPIRED", "Hold sudah berakhir.", 409));
    await expect(uploadManualRegistrationProof(child.id, child.userId, proof())).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    expect(mocks.storage.remove).toHaveBeenCalledWith([expect.stringContaining("pendaftaran/")]);
    expect(mocks.db.calonMurid.updateMany).not.toHaveBeenCalled();
  });

  it("jika cron berjalan saat upload, kode expired tetap diteruskan dan tidak membuat pembayaran", async () => {
    mocks.db.calonMurid.findUnique.mockResolvedValue({ ...child, statusKeseluruhan: "PILIH_JALUR" });
    mocks.requireHold.mockRejectedValue(new PaymentError("HOLD_EXPIRED", "Hold sudah berakhir.", 409));
    await expect(uploadManualRegistrationProof(child.id, child.userId, proof())).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    expect(mocks.db.pembayaran.create).not.toHaveBeenCalled();
    expect(mocks.storage.remove).toHaveBeenCalledOnce();
  });

  it("bukti valid dengan hold aktif memverifikasi dan membuka enrollment", async () => {
    expect((await uploadManualRegistrationProof(child.id, child.userId, proof())).status).toBe("VERIFIED");
    expect(mocks.verifyHold).toHaveBeenCalledWith(mocks.db, child.id, "payment-1", child.userId);
    expect(mocks.db.calonMurid.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { statusKeseluruhan: "ENROLLMENT" } }));
    expect(mocks.storage.remove).not.toHaveBeenCalled();
  });
});
