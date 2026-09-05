import { describe, expect, it } from "vitest";

import { KategoriTipe } from "@/generated/prisma/enums";
import {
  createBiayaSchema,
  createJalurSchema,
  createKategoriSchema,
} from "@/lib/master-data/schemas";

const validJalur = {
  nama: "Reguler",
  statusAktif: true,
  periodeMulai: "2026-09-01",
  periodeSelesai: "2026-09-30",
  kuotaMaks: 60,
  fallbackJalurId: null,
  hapusDataJikaGagal: false,
  pilihanJalurFinalAktif: false,
};

describe("master data schemas", () => {
  it("menolak periode jalur terbalik", () => {
    expect(
      createJalurSchema.safeParse({
        ...validJalur,
        periodeMulai: "2026-10-01",
      }).success,
    ).toBe(false);
  });

  it("menolak fallback dan auto-delete bersamaan", () => {
    expect(
      createJalurSchema.safeParse({
        ...validJalur,
        fallbackJalurId: "b2ad565e-5f24-4bb0-8a1c-f54cb908dd47",
        hapusDataJikaGagal: true,
      }).success,
    ).toBe(false);
  });

  it("menerima kategori dengan kuota nol", () => {
    expect(
      createKategoriSchema.safeParse({
        nama: "Alumni TKIT",
        tipe: KategoriTipe.ALUMNI_TKFI,
        statusAktif: true,
        periodeMulai: null,
        periodeSelesai: null,
        kuotaMaks: 0,
      }).success,
    ).toBe(true);
  });

  it("memerlukan fallback untuk pilihan jalur final", () => {
    expect(
      createJalurSchema.safeParse({
        ...validJalur,
        pilihanJalurFinalAktif: true,
      }).success,
    ).toBe(false);
    expect(
      createJalurSchema.safeParse({
        ...validJalur,
        fallbackJalurId: "b2ad565e-5f24-4bb0-8a1c-f54cb908dd47",
        pilihanJalurFinalAktif: true,
      }).success,
    ).toBe(true);
  });

  it("menolak nominal nol", () => {
    expect(
      createBiayaSchema.safeParse({
        jalurId: "b2ad565e-5f24-4bb0-8a1c-f54cb908dd47",
        kategoriId: "93d33917-75d2-42b9-8829-4c4c43708a42",
        nominal: 0,
        statusAktif: true,
      }).success,
    ).toBe(false);
  });
});
