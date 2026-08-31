import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AdminDeletionError } from "@/lib/admin-deletion/errors";
import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";

export function adminDeletionErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data penghapusan tidak valid.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof AdminDeletionError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Penghapusan belum dapat diproses.",
      },
    },
    { status: 500 },
  );
}

export async function readAdminDeletionJson(request: Request) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 8_192) {
    throw new AdminDeletionError(
      "INVALID_PAYLOAD",
      "Data penghapusan terlalu besar.",
      413,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AdminDeletionError(
      "INVALID_PAYLOAD",
      "Data harus berupa JSON.",
      400,
    );
  }
}
