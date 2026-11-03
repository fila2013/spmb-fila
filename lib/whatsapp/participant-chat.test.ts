import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ calonMurid: { findUnique: vi.fn() } }));
const requireRole = vi.hoisted(() => vi.fn());
const listActiveWhatsappTemplates = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("@/lib/auth/session", () => ({ requireRole }));
vi.mock("@/lib/whatsapp/template-service", () => ({ listActiveWhatsappTemplates }));

import { loadParticipantWhatsappDrafts } from "@/app/admin/peserta/whatsapp-actions";
import { FormType, StatusKeseluruhan, StatusPengumuman, UserRole } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";

const participantId = "be2d7dcc-9a20-4d21-90d5-875dd23625d5";
const template = { id: "template-1", judul: "Pengingat", kategori: "PENGINGAT_PEMBAYARAN", isiPesan: "Halo {nama_wali}" };
const regularRoute = { nama: "Reguler", pilihanJalurFinalAktif: false, pilihanJalurFinalTargetId: null };

function answer(label: string, value: string | null, formType: FormType = FormType.DATA_PRIBADI) {
  return { value, field: { formType, label } };
}

function participant() {
  return {
    namaAnak: "Alya & Bima",
    statusKeseluruhan: StatusKeseluruhan.MENUNGGU_DU,
    jalur: regularRoute,
    jalurAsal: null,
    menungguFallbackJalur: null,
    kategori: { nama: "Eksternal/Umum" },
    pengumuman: { statusAkhir: StatusPengumuman.DITERIMA, tanggalRilis: new Date("2026-10-01") },
    formResponses: [
      answer("Nama Ayah", "  Fikri  "),
      answer("No. WA Ayah", "0812-3456-7890"),
      answer("Nama ibu", "Maya"),
      answer("No. WA Bunda", "+62 813 4567 8900"),
    ],
  };
}

describe("draf WhatsApp peserta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireRole.mockResolvedValue({ userId: "admin-1" });
    database.calonMurid.findUnique.mockResolvedValue(participant());
    listActiveWhatsappTemplates.mockResolvedValue([template]);
  });
  afterEach(() => vi.useRealTimers());

  it("memeriksa role Admin dan hanya mengembalikan konteks draf serta kontak yang diperlukan", async () => {
    const result = await loadParticipantWhatsappDrafts(participantId);
    expect(requireRole).toHaveBeenCalledWith(UserRole.ADMIN);
    expect(database.calonMurid.findUnique).toHaveBeenCalledWith({
      where: { id: participantId },
      select: expect.objectContaining({
        formResponses: expect.objectContaining({
          where: { field: { formType: FormType.DATA_PRIBADI, label: { in: expect.arrayContaining(["Nama ayah", "No. WA bunda"]), mode: "insensitive" } } },
          select: { value: true, field: { select: { formType: true, label: true } } },
        }),
      }),
    });
    expect(listActiveWhatsappTemplates).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      participantName: "Alya & Bima",
      contacts: [
        { role: "ayah", name: "Fikri", number: "6281234567890" },
        { role: "bunda", name: "Maya", number: "6281345678900" },
      ],
      templates: [template],
      values: { nama_peserta: "Alya & Bima", jalur: "Reguler", kategori: "Eksternal/Umum", status: "Daftar Ulang" },
    });
  });

  it("mengabaikan nomor tidak valid dan Observasi tanpa memasangkan nama orang tua yang berbeda", async () => {
    database.calonMurid.findUnique.mockResolvedValue({
      ...participant(),
      formResponses: [
        answer("Nama ayah", "Fikri"),
        answer("No. WA ayah", "invalid"),
        answer("No. WA ayah", "081234567890", FormType.OBSERVASI),
        answer("Nama ibu", "Bukan dari data pribadi", FormType.OBSERVASI),
        answer("Nama Bunda", "   "),
        answer("No WA Ibu", "081345678900"),
      ],
    });
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({
      ok: true,
      contacts: [{ role: "bunda", name: "Ibu", number: "6281345678900" }],
    });
  });

  it("memberikan state kosong jika data kontak atau template aktif tidak tersedia", async () => {
    database.calonMurid.findUnique.mockResolvedValue({ ...participant(), formResponses: [] });
    listActiveWhatsappTemplates.mockResolvedValue([]);
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({ ok: true, contacts: [], templates: [] });
  });

  it("tidak memakai nomor lama jika jawaban yang lebih baru kosong atau tidak valid", async () => {
    database.calonMurid.findUnique.mockResolvedValue({
      ...participant(),
      formResponses: [
        answer("No. WA ayah", null),
        answer("No WA ayah", "081234567890"),
        answer("No. WA bunda", "tidak valid"),
        answer("No. WA ibu", "081345678900"),
      ],
    });
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({ ok: true, contacts: [] });
  });

  it("tidak memasukkan keputusan atau jalur final sebelum tanggal rilis Jakarta", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T16:59:59.000Z"));
    database.calonMurid.findUnique.mockResolvedValue({
      ...participant(),
      statusKeseluruhan: StatusKeseluruhan.DITERIMA,
      jalur: { ...regularRoute, nama: "Jalur pilihan final" },
      jalurAsal: { nama: "Jalur awal" },
      pengumuman: { statusAkhir: StatusPengumuman.DITERIMA, tanggalRilis: new Date("2026-11-03") },
    });
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({
      values: { jalur: "Jalur awal", status: "Menunggu Pengumuman" },
    });
    vi.setSystemTime(new Date("2026-11-02T17:00:00.000Z"));
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({
      values: { jalur: "Jalur pilihan final", status: "Diterima" },
    });
  });

  it("menampilkan status rilis efektif walau tahap tersimpan belum disinkronisasi", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T10:00:00.000Z"));
    database.calonMurid.findUnique.mockResolvedValue({
      ...participant(),
      statusKeseluruhan: StatusKeseluruhan.MENUNGGU_PENGUMUMAN,
      jalur: { ...regularRoute, pilihanJalurFinalAktif: true, pilihanJalurFinalTargetId: "route-target" },
      pengumuman: { statusAkhir: StatusPengumuman.DITERIMA, tanggalRilis: new Date("2026-11-03") },
    });
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({
      values: { status: "Pilih Kelas Final" },
    });
  });

  it("melindungi hasil dan jalur final jika baris pengumuman historis hilang, tanpa menyembunyikan tahap awal", async () => {
    database.calonMurid.findUnique.mockResolvedValueOnce({
      ...participant(),
      statusKeseluruhan: StatusKeseluruhan.DITERIMA,
      jalur: { ...regularRoute, nama: "Jalur pilihan final" },
      pengumuman: null,
    }).mockResolvedValueOnce({
      ...participant(),
      statusKeseluruhan: StatusKeseluruhan.PILIH_JALUR,
      pengumuman: null,
    });
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({
      values: { jalur: "Belum ditentukan", status: "Menunggu Pengumuman" },
    });
    expect(await loadParticipantWhatsappDrafts(participantId)).toMatchObject({
      values: { jalur: "Reguler", status: "Pilih Jalur" },
    });
  });

  it("menolak akses non-admin dan ID invalid sebelum membaca data", async () => {
    requireRole.mockRejectedValueOnce(new AuthorizationError("FORBIDDEN", "Akun tidak memiliki akses ke area ini."));
    expect(await loadParticipantWhatsappDrafts(participantId)).toEqual({ ok: false, message: "Akun tidak memiliki akses ke area ini." });
    expect(await loadParticipantWhatsappDrafts("not-a-uuid")).toEqual({ ok: false, message: "ID peserta tidak valid." });
    expect(database.calonMurid.findUnique).not.toHaveBeenCalled();
    expect(listActiveWhatsappTemplates).not.toHaveBeenCalled();
  });

  it("tidak mengungkap error internal atau membaca template untuk peserta yang tidak ada", async () => {
    database.calonMurid.findUnique.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("database-secret"));
    expect(await loadParticipantWhatsappDrafts(participantId)).toEqual({ ok: false, message: "Peserta tidak ditemukan." });
    expect(await loadParticipantWhatsappDrafts(participantId)).toEqual({ ok: false, message: "Draf WhatsApp belum dapat dimuat. Silakan coba lagi." });
    expect(listActiveWhatsappTemplates).not.toHaveBeenCalled();
  });
});
