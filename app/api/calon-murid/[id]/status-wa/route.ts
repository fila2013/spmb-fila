import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { admissionErrorResponse } from "@/lib/admission/http";
import {
  admissionIdSchema,
  whatsappConfirmationSchema,
} from "@/lib/admission/schemas";
import {
  confirmWhatsappMembership,
  getJoinWaPageData,
} from "@/lib/admission/service";
import { requireRole } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = admissionIdSchema.parse((await params).id);
    return NextResponse.json({ data: await getJoinWaPageData(id, wali.userId) });
  } catch (error) {
    return admissionErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = admissionIdSchema.parse((await params).id);
    whatsappConfirmationSchema.parse(await request.json());
    return NextResponse.json({
      data: await confirmWhatsappMembership(id, wali.userId),
    });
  } catch (error) {
    return admissionErrorResponse(error);
  }
}
