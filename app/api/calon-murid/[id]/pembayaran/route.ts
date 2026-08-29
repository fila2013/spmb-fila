import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { paymentErrorResponse } from "@/lib/payment/http";
import { getRegistrationPaymentStatus } from "@/lib/payment/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const payment = await getRegistrationPaymentStatus(id, user.userId);
    return NextResponse.json({
      data: payment
        ? {
            status: payment.status,
            orderId: payment.midtransOrderId,
            paymentType: payment.midtransPaymentType,
            createdAt: payment.createdAt,
            verifiedAt: payment.verifiedAt,
          }
        : null,
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
