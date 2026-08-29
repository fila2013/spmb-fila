import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
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
