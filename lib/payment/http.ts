import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { PaymentError } from "@/lib/payment/errors";

export function paymentErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return authorizationErrorResponse(error);
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data pembayaran tidak valid.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof PaymentError || error instanceof CalonMuridError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Layanan pembayaran belum dapat memproses permintaan.",
      },
    },
    { status: 500 },
  );
}

export async function readPaymentJson(request: Request, maxBytes = 65_536) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new PaymentError(
      "INVALID_PAYLOAD",
      "Payload notifikasi terlalu besar.",
      413,
    );
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new PaymentError(
      "INVALID_PAYLOAD",
      "Payload notifikasi terlalu besar.",
      413,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PaymentError(
      "INVALID_PAYLOAD",
      "Payload notifikasi harus berupa JSON.",
      400,
    );
  }
}
