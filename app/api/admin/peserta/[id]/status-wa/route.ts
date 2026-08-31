import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { admissionErrorResponse } from "@/lib/admission/http";
import {
  admissionIdSchema,
  whatsappInvitationSchema,
} from "@/lib/admission/schemas";
import { setWhatsappInvitationLink } from "@/lib/admission/service";
import { requireRole } from "@/lib/auth/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = admissionIdSchema.parse((await params).id);
    const input = whatsappInvitationSchema.parse(await request.json());
    return NextResponse.json({ data: await setWhatsappInvitationLink(id, input, admin.userId) });
  } catch (error) {
    return admissionErrorResponse(error);
  }
}
