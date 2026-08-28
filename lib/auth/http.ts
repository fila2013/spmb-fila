import { NextResponse } from "next/server";

import { AuthorizationError } from "@/lib/auth/errors";

export function authorizationErrorResponse(error: unknown) {
  if (!(error instanceof AuthorizationError)) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan." } },
      { status: 500 },
    );
  }

  const status =
    error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "RESOURCE_NOT_FOUND"
        ? 404
        : 403;
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status },
  );
}
