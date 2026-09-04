import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse, readStageJson } from "@/lib/stages/http";
import { deleteStageContentSchema, stageIdSchema, updateStageContentSchema } from "@/lib/stages/schemas";
import { deleteStageContent, updateStageContent } from "@/lib/stages/service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = stageIdSchema.parse((await params).id);
    const body = await readStageJson(request);
    const input = updateStageContentSchema.parse({
      id,
      ...(body && typeof body === "object" ? body : {}),
    });
    return NextResponse.json({ data: await updateStageContent(input, admin.userId) });
  } catch (error) { return stageErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const body = await readStageJson(request);
    const input = deleteStageContentSchema.parse({
      id: (await params).id,
      ...(body && typeof body === "object" ? body : {}),
    });
    return NextResponse.json({ data: await deleteStageContent(input.id, admin.userId) });
  } catch (error) { return stageErrorResponse(error); }
}
