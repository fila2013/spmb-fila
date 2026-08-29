import { ZodError } from "zod";
import { NextResponse } from "next/server";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";
import { MasterDataError } from "@/lib/master-data/errors";

export function masterDataErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return authorizationErrorResponse(error);
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dikirim tidak valid.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof MasterDataError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan." } },
    { status: 500 },
  );
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new MasterDataError(
      "VALIDATION_ERROR",
      "Request body harus berupa JSON yang valid.",
      400,
    );
  }
}

