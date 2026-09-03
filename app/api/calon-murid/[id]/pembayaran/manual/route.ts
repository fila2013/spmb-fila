import { NextResponse } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { calonMuridIdSchema } from "@/lib/calon-murid/schemas";
import { PaymentError } from "@/lib/payment/errors";
import { paymentErrorResponse } from "@/lib/payment/http";
import { MAX_REGISTRATION_PROOF_BYTES } from "@/lib/payment/constants";
import { uploadManualRegistrationProof } from "@/lib/payment/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const wali = await requireRole(UserRole.WALI_MURID);
    const id = calonMuridIdSchema.parse((await params).id);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REGISTRATION_PROOF_BYTES + 128 * 1024) {
      throw new PaymentError(
        "FILE_TOO_LARGE",
        "Bukti transfer maksimal 500 KB.",
        413,
      );
    }
    const formData = await request.formData();
    const file = formData.get("bukti");
    if (!(file instanceof File)) {
      throw new PaymentError("FILE_REQUIRED", "Pilih bukti transfer.", 422);
    }
    const payment = await uploadManualRegistrationProof(id, wali.userId, file);
    return NextResponse.json(
      {
        data: {
          id: payment.id,
          status: payment.status,
          nextStatus: "ENROLLMENT",
          createdAt: payment.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
