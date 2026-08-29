import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import { createBiayaSchema } from "@/lib/master-data/schemas";
import { createBiaya, listBiayaMatrix } from "@/lib/master-data/service";

export async function GET() {
  try {
    await requireRole(UserRole.ADMIN);
    return NextResponse.json({ data: await listBiayaMatrix() });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = createBiayaSchema.parse(await readJson(request));
    const data = await createBiaya(input, admin.userId);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

