import { z } from "zod";

import { KategoriTemplateWhatsapp } from "@/generated/prisma/enums";
import { WHATSAPP_TEMPLATE_BODY_MAX, WHATSAPP_TEMPLATE_TITLE_MAX, whatsappTemplateVariables } from "@/lib/whatsapp/templates";

const allowedTokens = new Set<string>(whatsappTemplateVariables.map(({ token }) => token));

function validText(value: string) {
  return value.isWellFormed() && !value.includes("\0");
}

export const whatsappTemplateSchema = z.object({
  id: z.uuid("ID template tidak valid.").optional(),
  judul: z.string({ error: "Masukkan judul template." }).trim()
    .min(1, "Judul template wajib diisi.")
    .max(WHATSAPP_TEMPLATE_TITLE_MAX, `Judul maksimal ${WHATSAPP_TEMPLATE_TITLE_MAX} karakter.`)
    .refine(validText, "Judul berisi karakter yang tidak valid."),
  kategori: z.enum(KategoriTemplateWhatsapp, { error: "Pilih kategori template yang tersedia." }),
  isiPesan: z.string({ error: "Masukkan isi pesan." }).trim()
    .min(1, "Isi pesan wajib diisi.")
    .max(WHATSAPP_TEMPLATE_BODY_MAX, `Isi pesan maksimal ${WHATSAPP_TEMPLATE_BODY_MAX} karakter.`)
    .refine(validText, "Isi pesan berisi karakter yang tidak valid.")
    .refine((message) => !/[{}]/.test(message.replace(/\{[^{}]*\}/g, (token) => allowedTokens.has(token) ? "" : token)),
      "Ada variabel yang tidak dikenal atau belum lengkap. Gunakan tombol sisip variabel."),
  statusAktif: z.boolean(),
});

export type WhatsappTemplateInput = z.infer<typeof whatsappTemplateSchema>;
