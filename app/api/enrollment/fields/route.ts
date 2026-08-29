import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { enrollmentErrorResponse } from "@/lib/enrollment/http";
import { formTypeSchema } from "@/lib/enrollment/schemas";
import { getEnrollmentFormData } from "@/lib/enrollment/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const url = new URL(request.url);
    const childId = calonMuridIdSchema.parse(
      url.searchParams.get("calon_murid_id"),
    );
    const formType = formTypeSchema.parse(url.searchParams.get("form_type"));
    const data = await getEnrollmentFormData(childId, user.userId, formType);
    return NextResponse.json({ data });
  } catch (error) {
    return enrollmentErrorResponse(error);
  }
}
