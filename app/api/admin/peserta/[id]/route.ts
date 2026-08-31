import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { adminDeletionErrorResponse, readAdminDeletionJson } from "@/lib/admin-deletion/http";
import { deleteParticipantSchema } from "@/lib/admin-deletion/schemas";
import { deleteParticipant } from "@/lib/admin-deletion/service";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse } from "@/lib/stages/http";
import { stageIdSchema } from "@/lib/stages/schemas";
import { getParticipant } from "@/lib/stages/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(UserRole.ADMIN);
    return NextResponse.json({ data: await getParticipant(stageIdSchema.parse((await params).id)) });
  } catch (error) { return stageErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = deleteParticipantSchema.parse({
      ...(await readAdminDeletionJson(request) as Record<string, unknown>),
      id: (await params).id,
    });
    return NextResponse.json({ data: await deleteParticipant(input, admin.userId) });
  } catch (error) {
    return adminDeletionErrorResponse(error);
  }
}
