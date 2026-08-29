import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import {
  calonMuridErrorResponse,
  readCalonMuridJson,
} from "@/lib/calon-murid/http";
import { createCalonMuridSchema } from "@/lib/calon-murid/schemas";
import {
  createCalonMurid,
  listOwnedCalonMurid,
} from "@/lib/calon-murid/service";

export async function GET() {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    return NextResponse.json({ data: await listOwnedCalonMurid(user.userId) });
  } catch (error) {
    return calonMuridErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const input = createCalonMuridSchema.parse(
      await readCalonMuridJson(request),
    );
    const data = await createCalonMurid(input, user.userId);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return calonMuridErrorResponse(error);
  }
}
