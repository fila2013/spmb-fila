import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse } from "@/lib/stages/http";
import { participantListFilterSchema } from "@/lib/stages/schemas";
import { listParticipants } from "@/lib/stages/service";

export async function GET(request: Request) {
  try {
    await requireRole(UserRole.ADMIN);
    const filters = participantListFilterSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return NextResponse.json({ data: await listParticipants(filters) });
  } catch (error) { return stageErrorResponse(error); }
}
