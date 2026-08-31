import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import {
  adminDeletionErrorResponse,
  readAdminDeletionJson,
} from "@/lib/admin-deletion/http";
import { deleteGuardianSchema } from "@/lib/admin-deletion/schemas";
import { deleteGuardian } from "@/lib/admin-deletion/service";
import { requireRole } from "@/lib/auth/session";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = deleteGuardianSchema.parse({
      ...(await readAdminDeletionJson(request) as Record<string, unknown>),
      id: (await params).id,
    });
    return NextResponse.json({ data: await deleteGuardian(input, admin.userId) });
  } catch (error) {
    return adminDeletionErrorResponse(error);
  }
}
