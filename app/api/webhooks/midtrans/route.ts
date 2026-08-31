import { revalidatePath } from "next/cache";
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
    revalidatePath("/dashboard");
    if (result.payment.calonMuridId) {
      revalidatePath(
        `/anak/${result.payment.calonMuridId}/pembayaran-pendaftaran`,
      );
      revalidatePath(
        `/anak/${result.payment.calonMuridId}/enrollment/data-pribadi`,
      );
    }
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      ignored: result.ignored,
      status: result.payment.status,
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
