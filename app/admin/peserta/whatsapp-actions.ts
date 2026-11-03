"use server";

import { z } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/session";
import {
  getParticipantWhatsappDrafts,
  type ParticipantWhatsappDraftsResult,
} from "@/lib/whatsapp/participant-chat";

const participantIdSchema = z.uuid("ID peserta tidak valid.");

export async function loadParticipantWhatsappDrafts(participantId: string): Promise<ParticipantWhatsappDraftsResult> {
  try {
    await requireRole(UserRole.ADMIN);
    const id = participantIdSchema.safeParse(participantId);
    if (!id.success) return { ok: false, message: "ID peserta tidak valid." };
    return await getParticipantWhatsappDrafts(id.data);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AuthorizationError
        ? error.message
        : "Draf WhatsApp belum dapat dimuat. Silakan coba lagi.",
    };
  }
}
