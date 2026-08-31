import { z } from "zod";

const confirmation = z.string().trim().min(1, "Konfirmasi wajib diisi.").max(300);

export const deleteParticipantSchema = z.object({
  id: z.uuid("ID peserta tidak valid."),
  confirmation,
});

export const deleteGuardianSchema = z.object({
  id: z.uuid("ID wali tidak valid."),
  confirmation,
});

export type DeleteParticipantInput = z.infer<typeof deleteParticipantSchema>;
export type DeleteGuardianInput = z.infer<typeof deleteGuardianSchema>;
