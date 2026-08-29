import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import { updateBiayaSchema } from "@/lib/master-data/schemas";
import { updateBiaya } from "@/lib/master-data/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const { id } = await params;
    const input = updateBiayaSchema.parse({ ...(await readJson(request)), id });
    return NextResponse.json({ data: await updateBiaya(input, admin.userId) });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

