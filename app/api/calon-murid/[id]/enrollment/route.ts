import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import {
  enrollmentErrorResponse,
  readEnrollmentJson,
} from "@/lib/enrollment/http";
import { enrollmentMutationSchema } from "@/lib/enrollment/schemas";
import {
  getEnrollmentOverview,
  saveEnrollment,
} from "@/lib/enrollment/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const data = await getEnrollmentOverview(id, user.userId);
    return NextResponse.json({ data });
  } catch (error) {
    return enrollmentErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const input = enrollmentMutationSchema.parse(
      await readEnrollmentJson(request),
    );
    const data = await saveEnrollment(id, user.userId, input);
    return NextResponse.json({ data });
  } catch (error) {
    return enrollmentErrorResponse(error);
  }
}
