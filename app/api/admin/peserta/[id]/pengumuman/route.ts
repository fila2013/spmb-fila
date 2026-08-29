import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse, readStageJson } from "@/lib/stages/http";
import { announcementInputSchema, stageIdSchema } from "@/lib/stages/schemas";
import { updateAnnouncement } from "@/lib/stages/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = stageIdSchema.parse((await params).id);
    const input = announcementInputSchema.parse(await readStageJson(request));
    return NextResponse.json({ data: await updateAnnouncement(id, input, admin.userId) });
  } catch (error) { return stageErrorResponse(error); }
}
