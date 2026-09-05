import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import {
  calonMuridErrorResponse,
  readCalonMuridJson,
} from "@/lib/calon-murid/http";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { finalRouteChoiceSchema } from "@/lib/final-route-choice/schemas";
import { chooseFinalRoute } from "@/lib/final-route-choice/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const input = finalRouteChoiceSchema.parse(
      await readCalonMuridJson(request),
    );
    return NextResponse.json({
      data: await chooseFinalRoute(id, input, wali.userId),
    });
  } catch (error) {
    return calonMuridErrorResponse(error);
  }
}
