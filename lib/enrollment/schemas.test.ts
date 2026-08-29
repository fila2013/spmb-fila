import { describe, expect, it } from "vitest";

import { FormType, TipeInput } from "@/generated/prisma/enums";
import {
  enrollmentMutationSchema,
  formFieldInputSchema,
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
});
