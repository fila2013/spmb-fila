import { z } from "zod";

import { StatusPembayaran, StatusUndanganWa } from "@/generated/prisma/enums";

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable().optional(),
);
const optionalNominal = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : value,
  z.coerce.number().int().positive("Nominal harus lebih dari nol.").max(2_147_483_647).nullable(),
);

export const admissionIdSchema = z.uuid("ID tidak valid.");
export const admissionVerificationSchema = z.object({
  status: z.enum([StatusPembayaran.VERIFIED, StatusPembayaran.REJECTED]),
  nominal: optionalNominal,
  catatanAdmin: optionalText(2_000),
}).superRefine((input, context) => {
  if (input.status === StatusPembayaran.VERIFIED && !input.nominal) {
    context.addIssue({ code: "custom", path: ["nominal"], message: "Nominal aktual wajib dicatat saat verifikasi.", input: input.nominal });
  }
  if (input.status === StatusPembayaran.REJECTED && !input.catatanAdmin) {
    context.addIssue({ code: "custom", path: ["catatanAdmin"], message: "Alasan penolakan wajib diisi.", input: input.catatanAdmin });
  }
});
export const whatsappInvitationSchema = z.object({
  status: z.enum([StatusUndanganWa.MENUNGGU, StatusUndanganWa.SUDAH_DIUNDANG]),
});

export type AdmissionVerificationInput = z.infer<typeof admissionVerificationSchema>;
export type WhatsappInvitationInput = z.infer<typeof whatsappInvitationSchema>;
