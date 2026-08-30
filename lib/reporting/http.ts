import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";

export function reportingErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Filter laporan tidak valid.", fields: error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Laporan belum dapat dibuat." } },
    { status: 500 },
  );
}
