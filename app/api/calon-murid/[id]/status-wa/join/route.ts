import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { admissionErrorResponse } from "@/lib/admission/http";
import { admissionIdSchema } from "@/lib/admission/schemas";
import { openWhatsappInvitation } from "@/lib/admission/service";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = admissionIdSchema.parse((await params).id);
    const inviteUrl = await openWhatsappInvitation(id, wali.userId);
    return NextResponse.redirect(inviteUrl, 307);
  } catch (error) {
    return admissionErrorResponse(error);
  }
}
