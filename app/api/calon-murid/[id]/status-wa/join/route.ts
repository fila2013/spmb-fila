import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { admissionErrorResponse } from "@/lib/admission/http";
import { AdmissionError } from "@/lib/admission/errors";
import { admissionIdSchema, whatsappInvitationSchema } from "@/lib/admission/schemas";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = admissionIdSchema.parse((await params).id);
    const text = await request.text();
    const input = text ? whatsappInvitationSchema.parse(JSON.parse(text)) : null;
    await openWhatsappInvitation(id, wali.userId, input?.inviteUrl);
    return NextResponse.json({ data: { opened: true } });
  } catch (error) {
    return admissionErrorResponse(error instanceof SyntaxError ? new AdmissionError("INVALID_JSON", "Data pembukaan link tidak valid.", 400) : error);
  }
}
