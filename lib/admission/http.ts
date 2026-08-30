import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AdmissionError } from "@/lib/admission/errors";
import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";

export function admissionErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Data daftar ulang tidak valid.", fields: error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  if (error instanceof AdmissionError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Tahap daftar ulang belum dapat diproses." } },
    { status: 500 },
  );
}
