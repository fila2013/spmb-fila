import { describe, expect, it } from "vitest";

import { initialEnrollmentValue, isUnchangedEnrollmentAnswer, isUnchangedRegistrationValue, registrationAutoFillValue } from "@/lib/enrollment/autofill";

describe("default enrollment dari pendaftaran awal", () => {
  it("menghubungkan nama, tempat, dan tanggal lahir pendaftaran ke field Data Pribadi", () => {
    const context = { email: "wali@example.com", asalTk: "TK A", namaAnak: "Muhammad Ali",
      tempatLahir: "Bandar Lampung", tanggalLahir: "2021-07-12" };
    expect(registrationAutoFillValue("nama_anak", context)).toBe(context.namaAnak);
    expect(registrationAutoFillValue("tempat_lahir", context)).toBe(context.tempatLahir);
    expect(registrationAutoFillValue("tanggal_lahir", context)).toBe(context.tanggalLahir);
  });

  it.each([
    ["nama anak", "Muhammad Ali"],
    ["tempat lahir", "Bandar Lampung"],
    ["tanggal lahir", "2021-07-12"],
  ])("mengisi %s hanya ketika jawaban enrollment kosong", (_label, fallback) => {
    expect(initialEnrollmentValue(undefined, fallback)).toBe(fallback);
    expect(initialEnrollmentValue(null, fallback)).toBe(fallback);
    expect(initialEnrollmentValue("", fallback)).toBe(fallback);
    expect(initialEnrollmentValue("   ", fallback)).toBe(fallback);
    expect(initialEnrollmentValue("Jawaban lama", fallback)).toBe("Jawaban lama");
  });

  it("menerima jawaban historis tanpa menimpanya namun menolak perubahan pada field terkunci", () => {
    expect(isUnchangedRegistrationValue("Nama awal", "Nama awal", undefined)).toBe(true);
    expect(isUnchangedRegistrationValue("Nama tersimpan", "Nama awal", "Nama tersimpan")).toBe(true);
    expect(isUnchangedRegistrationValue("Nama awal", "Nama awal", "Nama tersimpan")).toBe(false);
    expect(isUnchangedRegistrationValue("Nama baru", "Nama awal", "Nama tersimpan")).toBe(false);
    expect(isUnchangedEnrollmentAnswer(" Nama tersimpan ", "Nama tersimpan")).toBe(true);
    expect(isUnchangedEnrollmentAnswer(undefined, "Nama awal")).toBe(false);
  });
});
