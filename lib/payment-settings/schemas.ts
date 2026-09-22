import { z } from "zod";

import { ModePembayaranPendaftaran } from "@/generated/prisma/enums";

const accountNumberSchema = z.string().trim().transform(
  (value) => value.replace(/[\s.-]/g, ""),
).pipe(
  z.string().regex(/^\d{5,30}$/, "Nomor rekening harus terdiri dari 5–30 digit."),
);

export const paymentModeSchema = z.object({
  mode: z.enum(ModePembayaranPendaftaran),
  holdDurationMinutes: z.coerce
    .number()
    .int("Durasi hold harus berupa menit bulat.")
    .min(5, "Durasi hold minimal 5 menit.")
    .max(10080, "Durasi hold maksimal 7 hari.")
    .optional(),
});

export const createBankAccountSchema = z.object({
  namaBank: z.string().trim().min(2, "Nama bank terlalu pendek.").max(100),
  nomorRekening: accountNumberSchema,
  atasNama: z.string().trim().min(2, "Nama pemilik rekening terlalu pendek.").max(150),
});

export const updateBankAccountSchema = createBankAccountSchema.extend({
  id: z.uuid("ID rekening tidak valid."),
});

export const bankAccountIdSchema = z.uuid("ID rekening tidak valid.");

export type PaymentModeInput = z.infer<typeof paymentModeSchema>;
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
