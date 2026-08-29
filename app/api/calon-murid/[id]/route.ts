import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridErrorResponse } from "@/lib/calon-murid/http";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { getOwnedCalonMurid } from "@/lib/calon-murid/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    return NextResponse.json({
      data: await getOwnedCalonMurid(id, user.userId),
    });
  } catch (error) {
    return calonMuridErrorResponse(error);
  }
}
