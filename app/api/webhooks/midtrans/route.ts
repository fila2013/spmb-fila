import { NextResponse } from "next/server";

import { paymentErrorResponse, readPaymentJson } from "@/lib/payment/http";
import { midtransNotificationSchema } from "@/lib/payment/schemas";
import { processMidtransNotification } from "@/lib/payment/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const notification = midtransNotificationSchema.parse(
      await readPaymentJson(request),
    );
    const result = await processMidtransNotification(notification);
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      ignored: result.ignored,
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
