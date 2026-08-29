import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { stageErrorResponse, readStageJson } from "@/lib/stages/http";
import { stageContentInputSchema, stageTypeSchema } from "@/lib/stages/schemas";
import { createStageContent, listStageContent } from "@/lib/stages/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(UserRole.ADMIN);
    const value = new URL(request.url).searchParams.get("tahap");
    const tahap = value ? stageTypeSchema.parse(value) : undefined;
    return NextResponse.json({ data: await listStageContent(tahap) });
  } catch (error) { return stageErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = stageContentInputSchema.parse(await readStageJson(request));
    return NextResponse.json({ data: await createStageContent(input, admin.userId) }, { status: 201 });
  } catch (error) { return stageErrorResponse(error); }
}
