import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse, readStageJson } from "@/lib/stages/http";
import { assessmentInputSchema, stageIdSchema } from "@/lib/stages/schemas";
import { updateAssessment } from "@/lib/stages/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = stageIdSchema.parse((await params).id);
    const input = assessmentInputSchema.parse(await readStageJson(request));
    return NextResponse.json({ data: await updateAssessment(id, input, admin.userId) });
  } catch (error) { return stageErrorResponse(error); }
}
