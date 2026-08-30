import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";
import { FallbackError } from "@/lib/fallback/errors";
import { StageError } from "@/lib/stages/errors";

export function stageErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Data tahap tidak valid.", fields: error.flatten().fieldErrors } }, { status: 422 });
  }
  if (error instanceof StageError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof FallbackError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Data tahap belum dapat diproses." } }, { status: 500 });
}

export async function readStageJson(request: Request, maxBytes = 65_536) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new StageError("INVALID_PAYLOAD", "Data terlalu besar.", 413);
  try { return JSON.parse(text) as unknown; } catch { throw new StageError("INVALID_PAYLOAD", "Data harus berupa JSON.", 400); }
}
