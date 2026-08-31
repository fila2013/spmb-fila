import { z } from "zod";

import { StatusPembayaran } from "@/generated/prisma/enums";

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
  proofReviewed: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.boolean(),
  ),
}).superRefine((input, context) => {
  if (input.status === StatusPembayaran.VERIFIED && !input.nominal) {
    context.addIssue({ code: "custom", path: ["nominal"], message: "Nominal aktual wajib dicatat saat verifikasi.", input: input.nominal });
  }
  if (input.status === StatusPembayaran.REJECTED && !input.catatanAdmin) {
    context.addIssue({ code: "custom", path: ["catatanAdmin"], message: "Alasan penolakan wajib diisi.", input: input.catatanAdmin });
  }
  if (input.status === StatusPembayaran.VERIFIED && !input.proofReviewed) {
    context.addIssue({ code: "custom", path: ["proofReviewed"], message: "Preview bukti wajib diperiksa sebelum pembayaran disetujui.", input: input.proofReviewed });
  }
});
export const whatsappInvitationSchema = z.object({
  inviteUrl: z.string().trim().max(2_048).transform((value, context) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Link grup WhatsApp tidak valid.", input: value });
      return z.NEVER;
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "chat.whatsapp.com" ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      !/^\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)
    ) {
      context.addIssue({ code: "custom", message: "Gunakan link grup resmi https://chat.whatsapp.com/....", input: value });
      return z.NEVER;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  }),
});
export const whatsappConfirmationSchema = z.object({
  confirmed: z.literal(true),
});

export type AdmissionVerificationInput = z.infer<typeof admissionVerificationSchema>;
export type WhatsappInvitationInput = z.infer<typeof whatsappInvitationSchema>;
