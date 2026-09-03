import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import { createBankAccountSchema } from "@/lib/payment-settings/schemas";
import {
  createBankAccount,
  listBankAccounts,
} from "@/lib/payment-settings/service";

export async function GET() {
  try {
    await requireRole(UserRole.ADMIN);
    return NextResponse.json({ data: await listBankAccounts() });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const input = createBankAccountSchema.parse(await readJson(request));
    return NextResponse.json(
      { data: await createBankAccount(input, admin.userId) },
      { status: 201 },
    );
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}
