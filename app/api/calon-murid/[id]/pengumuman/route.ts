import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse } from "@/lib/stages/http";
import { stageIdSchema } from "@/lib/stages/schemas";
import { getAnnouncementForWali } from "@/lib/stages/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    return NextResponse.json({ data: await getAnnouncementForWali(stageIdSchema.parse((await params).id), wali.userId) });
  } catch (error) { return stageErrorResponse(error); }
}
