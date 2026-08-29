import { describe, expect, it } from "vitest";

import { TipeInput } from "@/generated/prisma/enums";
import {
  fieldValueError,
  isIndonesianWhatsApp,
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
});
