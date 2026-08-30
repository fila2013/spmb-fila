import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";
import { FallbackError } from "@/lib/fallback/errors";

export function fallbackErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Data fallback tidak valid.", fields: error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  if (error instanceof FallbackError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Fallback belum dapat diproses." } },
    { status: 500 },
  );
}
