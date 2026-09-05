import { z } from "zod";

import { PilihanJalurFinal } from "@/generated/prisma/enums";

export const finalRouteChoiceSchema = z.object({
  pilihan: z.enum([
    PilihanJalurFinal.TETAP_JALUR_ASAL,
    PilihanJalurFinal.JALUR_FALLBACK,
  ]),
  confirmation: z.literal("SETUJU", {
    error: "Konfirmasi keputusan final wajib diberikan.",
  }),
});

export type FinalRouteChoiceInput = z.infer<typeof finalRouteChoiceSchema>;
