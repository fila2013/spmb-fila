import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import {
  calonMuridErrorResponse,
  readCalonMuridJson,
} from "@/lib/calon-murid/http";
import {
  calonMuridIdSchema,
  selectJalurSchema,
} from "@/lib/calon-murid/schemas";
import { selectJalur } from "@/lib/calon-murid/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const input = selectJalurSchema.parse(await readCalonMuridJson(request));
    return NextResponse.json({
      data: await selectJalur(id, input, user.userId),
    });
  } catch (error) {
    return calonMuridErrorResponse(error);
  }
}
