import { z } from "zod";

import { FormType, TipeInput } from "@/generated/prisma/enums";

export const formTypeSchema = z.enum(FormType);

export const enrollmentMutationSchema = z
  .object({
    formType: formTypeSchema,
    intent: z.enum(["draft", "submit"]),
    responses: z
      .array(
        z.object({
          fieldId: z.uuid(),
          value: z.string().max(10_000),
        }),
      )
      .max(100),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.responses.forEach((response, index) => {
      if (ids.has(response.fieldId)) {
        context.addIssue({
          code: "custom",
          path: ["responses", index, "fieldId"],
          message: "Field tidak boleh dikirim lebih dari sekali.",
        });
      }
      ids.add(response.fieldId);
    });
  });

const nullableValidationSchema = z
  .union([z.literal("format_wa_indonesia"), z.null()]);
const nullableAutoFillSchema = z.union([
  z.enum(["akun_email", "kategori_asal_tk"]),
  z.null(),
]);

export const formFieldInputSchema = z
  .object({
    formType: formTypeSchema,
    label: z.string().trim().min(2).max(150),
    tipeInput: z.enum(TipeInput),
    wajib: z.boolean(),
    urutan: z.number().int().min(0).max(10_000),
    validasi: nullableValidationSchema,
    autoFillSource: nullableAutoFillSchema,
  })
  .superRefine((value, context) => {
    if (
      value.validasi === "format_wa_indonesia" &&
      value.tipeInput !== TipeInput.TEL
    ) {
      context.addIssue({
        code: "custom",
        path: ["validasi"],
        message: "Validasi WhatsApp hanya dapat digunakan pada tipe Tel.",
      });
    }
    if (
      value.autoFillSource === "akun_email" &&
      (value.formType !== FormType.DATA_PRIBADI ||
        value.tipeInput !== TipeInput.EMAIL)
    ) {
      context.addIssue({
        code: "custom",
        path: ["autoFillSource"],
        message: "Auto-fill email hanya tersedia untuk field Email pada Data Pribadi.",
      });
    }
    if (
      value.autoFillSource === "kategori_asal_tk" &&
      (value.formType !== FormType.DATA_PRIBADI ||
        value.tipeInput !== TipeInput.TEXT)
    ) {
      context.addIssue({
        code: "custom",
        path: ["autoFillSource"],
        message: "Auto-fill asal TK hanya tersedia untuk field Text pada Data Pribadi.",
      });
    }
  });

export const updateFormFieldSchema = formFieldInputSchema.extend({
  id: z.uuid(),
});

export const formFieldIdSchema = z.uuid();

export type EnrollmentMutationInput = z.infer<
  typeof enrollmentMutationSchema
>;
export type FormFieldInput = z.infer<typeof formFieldInputSchema>;
export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>;
