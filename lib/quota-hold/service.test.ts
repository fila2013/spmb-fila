import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(), $transaction: vi.fn(),
  calonMurid: { findUnique: vi.fn(), update: vi.fn() },
  formField: { findFirst: vi.fn() },
  holdKuotaPendaftaran: { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  jalur: { findUnique: vi.fn(), update: vi.fn() },
  kategoriPendaftar: { findUnique: vi.fn(), update: vi.fn() },
  pembayaran: { updateMany: vi.fn() }, biayaPendaftaran: { findFirst: vi.fn() },
  pengaturanPembayaran: { findUnique: vi.fn() }, auditLog: { create: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { KategoriTipe, StatusHoldKuota, StatusKeseluruhan } from "@/generated/prisma/enums";
import { selectKategori } from "@/lib/calon-murid/service";
import { reserveRegistrationQuotaInTransaction, verifyRegistrationQuotaHoldInTransaction } from "@/lib/quota-hold/service";

const now = new Date("2026-10-26T00:00:00.000Z");
const child = { id: "child-1", userId: "wali-1", jalurId: "route-1", kategoriId: "category-1", tempatLahir: "Lampung", tanggalLahir: new Date("2021-06-01"), statusKeseluruhan: StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR };
const hold = { id: "hold-1", calonMuridId: child.id, jalurId: child.jalurId, kategoriId: child.kategoriId, status: StatusHoldKuota.PENDING_PAYMENT, expiresAt: new Date(now.getTime() + 60_000) };
const capacity = { kuotaMaks: 1, kuotaTerpakai: 0, statusAktif: true, periodeMulai: null, periodeSelesai: null };

describe("expiry dan pemulihan hold kuota server", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
    db.$transaction.mockImplementation((work) => work(db));
    db.calonMurid.findUnique.mockResolvedValue(child);
    db.calonMurid.update.mockImplementation(({ data }) => Promise.resolve({ ...child, ...data }));
    db.formField.findFirst.mockResolvedValue({ id: "dob", tipeInput: "DATE", wajib: true, minAgeYears: 5, ageReferenceMonth: 7, ageReferenceYear: 2027 });
    db.holdKuotaPendaftaran.findUnique.mockResolvedValue(hold);
    db.holdKuotaPendaftaran.count.mockResolvedValue(0);
    db.holdKuotaPendaftaran.upsert.mockImplementation(({ update }) => Promise.resolve({ ...hold, ...update }));
    db.jalur.findUnique.mockResolvedValue({ id: child.jalurId, ...capacity });
    db.kategoriPendaftar.findUnique.mockResolvedValue({ id: child.kategoriId, tipe: KategoriTipe.EKSTERNAL, ...capacity });
    db.biayaPendaftaran.findFirst.mockResolvedValue({ id: "fee-1", nominal: 300000 });
    db.pengaturanPembayaran.findUnique.mockResolvedValue({ holdDurationMinutes: 1440 });
  });
  afterEach(() => vi.useRealTimers());

  it("kedaluwarsa tepat pada batas UTC, tanpa increment counter", async () => {
    db.holdKuotaPendaftaran.findUnique.mockResolvedValue({ ...hold, expiresAt: now });
    await expect(verifyRegistrationQuotaHoldInTransaction(db as never, child.id, "payment-1", child.userId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    expect(db.jalur.update).not.toHaveBeenCalled();
    expect(db.kategoriPendaftar.update).not.toHaveBeenCalled();
  });

  it("memeriksa ulang expiry setelah menunggu row lock", async () => {
    db.$queryRaw.mockImplementationOnce(async () => {}).mockImplementationOnce(async () => {}).mockImplementationOnce(async () => { vi.setSystemTime(new Date(hold.expiresAt.getTime() + 1)); });
    await expect(verifyRegistrationQuotaHoldInTransaction(db as never, child.id, "payment-1", child.userId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    expect(db.jalur.update).not.toHaveBeenCalled();
  });

  it("tidak memperpanjang hold aktif untuk request berulang", async () => {
    expect((await reserveRegistrationQuotaInTransaction(db as never, child, child.userId)).reused).toBe(true);
    expect(db.holdKuotaPendaftaran.upsert).not.toHaveBeenCalled();
  });

  it("pemilihan kategori ulang mengganti hold expired jika kursi masih ada", async () => {
    db.holdKuotaPendaftaran.findUnique.mockResolvedValue({ ...hold, expiresAt: now });
    await selectKategori(child.id, { kategoriId: child.kategoriId, subKategoriEnum: null, subKategoriText: "TK Uji" }, child.userId);
    expect(db.holdKuotaPendaftaran.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "PENDING_PAYMENT", expiresAt: new Date("2026-10-27T00:00:00.000Z") }) }));
    expect(db.jalur.update).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 30000 });
  });

  it.each(["QUOTA_FULL", "QUOTA_HELD"])("pemulihan tetap ditolak saat kursi tidak tersedia: %s", async (code) => {
    db.holdKuotaPendaftaran.findUnique.mockResolvedValue({ ...hold, expiresAt: now });
    if (code === "QUOTA_FULL") db.jalur.findUnique.mockResolvedValue({ id: child.jalurId, ...capacity, kuotaTerpakai: 1 });
    else db.holdKuotaPendaftaran.count.mockResolvedValue(1);
    await expect(reserveRegistrationQuotaInTransaction(db as never, child, child.userId)).rejects.toMatchObject({ code });
    expect(db.holdKuotaPendaftaran.upsert).not.toHaveBeenCalled();
  });

  it("tidak mengubah pilihan atau kuota milik wali lain", async () => {
    await expect(selectKategori(child.id, { kategoriId: child.kategoriId, subKategoriEnum: null, subKategoriText: "TK Uji" }, "wali-lain")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.holdKuotaPendaftaran.upsert).not.toHaveBeenCalled();
  });
});
