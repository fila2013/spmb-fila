import { describe, expect, it } from "vitest";

import { FormType, TipeInput } from "@/generated/prisma/enums";
import {
  enrollmentMutationSchema,
  formFieldInputSchema,
  registrationAgeRuleSchema,
} from "@/lib/enrollment/schemas";

describe("enrollment schemas", () => {
  it("menolak field response duplikat", () => {
    const fieldId = "00000000-0000-4000-8000-000000000001";
    expect(
      enrollmentMutationSchema.safeParse({
        formType: FormType.DATA_PRIBADI,
        intent: "draft",
        responses: [
          { fieldId, value: "A" },
          { fieldId, value: "B" },
        ],
      }).success,
    ).toBe(false);
  });

  it("membatasi validasi WhatsApp ke tipe Tel", () => {
    const result = formFieldInputSchema.safeParse({
      formType: FormType.DATA_PRIBADI,
      label: "Nomor WA",
      tipeInput: TipeInput.TEXT,
      wajib: true,
      urutan: 1,
      validasi: "format_wa_indonesia",
      autoFillSource: null,
    });
    expect(result.success).toBe(false);
  });

  it("membatasi auto-fill email ke Data Pribadi bertipe Email", () => {
    const result = formFieldInputSchema.safeParse({
      formType: FormType.OBSERVASI,
      label: "Email",
      tipeInput: TipeInput.EMAIL,
      wajib: true,
      urutan: 1,
      validasi: null,
      autoFillSource: "akun_email",
    });
    expect(result.success).toBe(false);
  });

  it("mengizinkan konfigurasi usia lengkap hanya pada tipe Tanggal", () => {
    const base = {
      formType: FormType.DATA_PRIBADI,
      label: "Tanggal lahir",
      tipeInput: TipeInput.DATE,
      wajib: true,
      urutan: 3,
      validasi: null,
      autoFillSource: null,
      minAgeYears: 6,
      ageReferenceMonth: 7,
      ageReferenceYear: 2027,
    };
    expect(formFieldInputSchema.safeParse(base).success).toBe(true);
    expect(formFieldInputSchema.safeParse({ ...base, ageReferenceMonth: null }).success).toBe(false);
    expect(formFieldInputSchema.safeParse({ ...base, ageReferenceMonth: 13 }).success).toBe(false);
    expect(formFieldInputSchema.safeParse({ ...base, tipeInput: TipeInput.TEXT }).success).toBe(false);
    expect(formFieldInputSchema.safeParse({ ...base, minAgeYears: null, ageReferenceMonth: null, ageReferenceYear: null }).success).toBe(true);
  });

  it("membatasi auto-fill tanggal lahir pada Data Pribadi bertipe Tanggal", () => {
    const base = { formType: FormType.DATA_PRIBADI, label: "Tanggal lahir", tipeInput: TipeInput.DATE,
      wajib: true, urutan: 3, validasi: null, autoFillSource: "tanggal_lahir",
      minAgeYears: 6, ageReferenceMonth: 7, ageReferenceYear: 2027 };
    expect(formFieldInputSchema.safeParse(base).success).toBe(true);
    expect(formFieldInputSchema.safeParse({ ...base, minAgeYears: null, ageReferenceMonth: null, ageReferenceYear: null }).success).toBe(false);
    expect(formFieldInputSchema.safeParse({ ...base, tipeInput: TipeInput.TEXT }).success).toBe(false);
    expect(formFieldInputSchema.safeParse({ ...base, formType: FormType.OBSERVASI }).success).toBe(false);
  });

  it("memvalidasi panel aturan usia admin secara dinamis", () => {
    const input = { fieldId: "00000000-0000-4000-8000-000000000001", minAgeYears: 6,
      ageReferenceMonth: 7, ageReferenceYear: 2027 };
    expect(registrationAgeRuleSchema.safeParse(input).success).toBe(true);
    expect(registrationAgeRuleSchema.safeParse({ ...input, minAgeYears: 5, ageReferenceMonth: 1, ageReferenceYear: 2026 }).success).toBe(true);
    expect(registrationAgeRuleSchema.safeParse({ ...input, ageReferenceMonth: 13 }).success).toBe(false);
    expect(registrationAgeRuleSchema.safeParse({ ...input, minAgeYears: 0 }).success).toBe(false);
    expect(registrationAgeRuleSchema.safeParse({ ...input, ageReferenceYear: 2026.5 }).success).toBe(false);
  });
});
