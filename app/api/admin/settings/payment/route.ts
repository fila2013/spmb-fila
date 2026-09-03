import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import { paymentModeSchema } from "@/lib/payment-settings/schemas";
import {
  getPaymentSettingsData,
  updatePaymentMode,
} from "@/lib/payment-settings/service";

export async function GET() {
  try {
    await requireRole(UserRole.ADMIN);
    return NextResponse.json({ data: await getPaymentSettingsData() });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = paymentModeSchema.parse(await readJson(request));
    return NextResponse.json({
      data: await updatePaymentMode(input, admin.userId),
    });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}
