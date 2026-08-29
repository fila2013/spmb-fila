import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse } from "@/lib/stages/http";
import { listParticipants } from "@/lib/stages/service";

export async function GET(request: Request) {
  try {
    await requireRole(UserRole.ADMIN);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100);
    return NextResponse.json({ data: await listParticipants(query) });
  } catch (error) { return stageErrorResponse(error); }
}
