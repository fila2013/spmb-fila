import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { fallbackErrorResponse } from "@/lib/fallback/http";
import { listFallbackQueue } from "@/lib/fallback/service";
import { stageIdSchema } from "@/lib/stages/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(UserRole.ADMIN);
    const id = stageIdSchema.parse((await params).id);
    return NextResponse.json({ data: await listFallbackQueue(id) });
  } catch (error) {
    return fallbackErrorResponse(error);
  }
}
