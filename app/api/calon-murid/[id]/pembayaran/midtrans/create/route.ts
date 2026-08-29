import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { getMidtransEnvironment } from "@/lib/env/server";
import { paymentErrorResponse } from "@/lib/payment/http";
import { midtransUrls } from "@/lib/payment/rules";
import { createRegistrationSnapPayment } from "@/lib/payment/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const result = await createRegistrationSnapPayment(id, user);
    const environment = getMidtransEnvironment();
    return NextResponse.json(
      {
        data: {
          snapToken: result.snapToken,
          orderId: result.payment.midtransOrderId,
          status: result.payment.status,
          reused: result.reused,
          environment: midtransUrls(environment.MIDTRANS_IS_PRODUCTION)
            .environment,
        },
      },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
