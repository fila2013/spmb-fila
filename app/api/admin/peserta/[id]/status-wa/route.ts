import { UserRole } from "@/generated/prisma/enums";
import { AdmissionError } from "@/lib/admission/errors";
import { admissionErrorResponse } from "@/lib/admission/http";
import {
  admissionIdSchema,
} from "@/lib/admission/schemas";
import { requireRole } from "@/lib/auth/session";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(UserRole.ADMIN);
    admissionIdSchema.parse((await params).id);
    throw new AdmissionError("INVITATION_MANAGED_BY_CONTENT", "Link grup dikelola melalui menu Konten Join WhatsApp, bukan per peserta.", 410);
  } catch (error) {
    return admissionErrorResponse(error);
  }
}
