import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";
import {
  EnrollmentError,
  EnrollmentValidationError,
} from "@/lib/enrollment/errors";

export function enrollmentErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return authorizationErrorResponse(error);
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data enrollment tidak valid.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof EnrollmentValidationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          fields: error.fieldErrors,
        },
      },
      { status: error.status },
    );
  }
  if (error instanceof EnrollmentError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Enrollment belum dapat diproses.",
      },
    },
    { status: 500 },
  );
}

export async function readEnrollmentJson(request: Request, maxBytes = 262_144) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new EnrollmentError(
      "INVALID_PAYLOAD",
      "Data enrollment terlalu besar.",
      413,
    );
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new EnrollmentError(
      "INVALID_PAYLOAD",
      "Data enrollment terlalu besar.",
      413,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EnrollmentError(
      "INVALID_PAYLOAD",
      "Data enrollment harus berupa JSON.",
      400,
    );
  }
}
