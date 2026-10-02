import { describe, expect, it } from "vitest";

import { TipeInput } from "@/generated/prisma/enums";
import {
  fieldValueError,
  isIndonesianWhatsApp,
  meetsMinimumAgeByMonth,
  validateFieldValues,
} from "@/lib/enrollment/rules";

describe("enrollment rules", () => {
  it.each([
    "081234567890",
    "6281234567890",
    "+6281234567890",
  ])("menerima nomor WhatsApp Indonesia %s", (value) => {
    expect(isIndonesianWhatsApp(value)).toBe(true);
  });

  it.each([
    "81234567890",
    "0812 3456 7890",
    "0812-3456-7890",
    "+62123456789",
    "08123",
  ])("menolak nomor WhatsApp tidak valid %s", (value) => {
    expect(isIndonesianWhatsApp(value)).toBe(false);
  });

  it("mengizinkan field wajib kosong pada draft, tetapi tidak pada final", () => {
    const field = {
      id: "field-1",
      tipeInput: TipeInput.TEXT,
      wajib: true,
      validasi: null,
    };
    expect(fieldValueError(field, "", false)).toBeNull();
    expect(fieldValueError(field, "", true)).toBe("Field ini wajib diisi.");
  });

  it("memvalidasi tipe email, tanggal, angka, dan nomor WA", () => {
    const fields = [
      { id: "email", tipeInput: TipeInput.EMAIL, wajib: true, validasi: null },
      { id: "date", tipeInput: TipeInput.DATE, wajib: true, validasi: null },
      { id: "number", tipeInput: TipeInput.NUMBER, wajib: true, validasi: null },
      { id: "wa", tipeInput: TipeInput.TEL, wajib: true, validasi: "format_wa_indonesia" },
    ];
    const errors = validateFieldValues(
      fields,
      new Map([
        ["email", "bukan-email"],
        ["date", "2026-02-30"],
        ["number", "dua"],
        ["wa", "12345"],
      ]),
      true,
    );
    expect(Object.keys(errors)).toEqual(["email", "date", "number", "wa"]);
  });

  it("menghitung batas usia berdasarkan bulan acuan, termasuk seluruh tanggal di bulan itu", () => {
    expect(meetsMinimumAgeByMonth("2021-07-31", 6, 7, 2027)).toBe(true);
    expect(meetsMinimumAgeByMonth("2021-08-01", 6, 7, 2027)).toBe(false);
    expect(meetsMinimumAgeByMonth("2021-06-30", 6, 7, 2027)).toBe(true);
    expect(meetsMinimumAgeByMonth("2021-07-31", 6, 6, 2027)).toBe(false);
    expect(meetsMinimumAgeByMonth("2021-07-31", 6, 8, 2027)).toBe(true);
    expect(meetsMinimumAgeByMonth("2021-02-30", 6, 7, 2027)).toBe(false);
  });

  it.each([
    { birth: "2020-12-31", years: 6, month: 7, year: 2027, eligible: true },
    { birth: "2021-07-31", years: 6, month: 7, year: 2027, eligible: true },
    { birth: "2021-08-01", years: 6, month: 7, year: 2027, eligible: false },
    { birth: "2021-12-06", years: 6, month: 7, year: 2027, eligible: false },
    { birth: "2022-01-01", years: 6, month: 7, year: 2027, eligible: false },
    { birth: "2021-01-31", years: 5, month: 1, year: 2026, eligible: true },
    { birth: "2021-02-01", years: 5, month: 1, year: 2026, eligible: false },
    { birth: "2024-12-31", years: 4, month: 12, year: 2028, eligible: true },
    { birth: "2025-01-01", years: 4, month: 12, year: 2028, eligible: false },
  ])("aturan dinamis $years tahun per $month/$year untuk kelahiran $birth", ({ birth, years, month, year, eligible }) => {
    expect(meetsMinimumAgeByMonth(birth, years, month, year)).toBe(eligible);
  });

  it("menyusun pesan penolakan dari konfigurasi terbaru", () => {
    const field = { id: "birth", tipeInput: TipeInput.DATE, wajib: true, validasi: null,
      minAgeYears: 5, ageReferenceMonth: 1, ageReferenceYear: 2026 };
    expect(fieldValueError(field, "2021-02-01", true)).toBe(
      "Mohon maaf, usia calon murid belum mencapai batas minimal 5 tahun per Januari 2026.",
    );
    expect(fieldValueError({ ...field, ageReferenceMonth: 2 }, "2021-02-01", true)).toBeNull();
  });

  it("memberi alasan penolakan usia pada draft dan submit, tanpa memengaruhi tanggal biasa", () => {
    const birthField = {
      id: "birth",
      tipeInput: TipeInput.DATE,
      wajib: true,
      validasi: null,
      minAgeYears: 6,
      ageReferenceMonth: 7,
      ageReferenceYear: 2027,
    };
    const message = "Mohon maaf, usia calon murid belum mencapai batas minimal 6 tahun per Juli 2027.";
    expect(fieldValueError(birthField, "2021-08-01", false)).toBe(message);
    expect(fieldValueError(birthField, "2021-08-01", true)).toBe(message);
    expect(fieldValueError(birthField, "2021-07-31", true)).toBeNull();
    expect(fieldValueError({ ...birthField, minAgeYears: null }, "2021-08-01", true)).toBeNull();
  });
});
