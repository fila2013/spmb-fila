import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { masterDataErrorResponse, readJson } from "@/lib/master-data/http";
import {
  bankAccountIdSchema,
  updateBankAccountSchema,
} from "@/lib/payment-settings/schemas";
import {
  deleteBankAccount,
  updateBankAccount,
} from "@/lib/payment-settings/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const { id } = await params;
    const input = updateBankAccountSchema.parse({
      ...(await readJson(request)),
      id,
    });
    return NextResponse.json({
      data: await updateBankAccount(input, admin.userId),
    });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(UserRole.ADMIN);
    const id = bankAccountIdSchema.parse((await params).id);
    return NextResponse.json({
      data: await deleteBankAccount(id, admin.userId),
    });
  } catch (error) {
    return masterDataErrorResponse(error);
  }
}
