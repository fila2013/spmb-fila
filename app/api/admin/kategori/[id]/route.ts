import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import { updateKategoriSchema } from "@/lib/master-data/schemas";
import { updateKategori } from "@/lib/master-data/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const { id } = await params;
    const input = updateKategoriSchema.parse({ ...(await readJson(request)), id });
    return NextResponse.json({ data: await updateKategori(input, admin.userId) });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

