import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse, readStageJson } from "@/lib/stages/http";
import { stageIdSchema, updateStageContentSchema } from "@/lib/stages/schemas";
import { updateStageContent } from "@/lib/stages/service";

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
