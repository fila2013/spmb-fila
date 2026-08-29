import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import { createJalurSchema } from "@/lib/master-data/schemas";
import { createJalur, listJalur } from "@/lib/master-data/service";

export async function GET() {
  try {
    await requireRole(UserRole.ADMIN);
    return NextResponse.json({ data: await listJalur() });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = createJalurSchema.parse(await readJson(request));
    const data = await createJalur(input, admin.userId);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

