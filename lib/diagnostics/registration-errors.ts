import "server-only";

import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { CalonMuridError } from "@/lib/calon-murid/errors";
import { PaymentError } from "@/lib/payment/errors";

function databaseCode(error: unknown) {
  if (error instanceof Error && "code" in error && typeof error.code === "string" && /^P\d{4}$/.test(error.code)) return error.code;
  return null;
}

function diagnosticMetadata(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || depth > 4) return;
  const record = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of ["code", "originalCode", "kind", "modelName", "constraint", "constraintName", "table", "column"]) {
    if (typeof record[key] === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(record[key])) safe[key] = record[key];
  }
  for (const key of ["meta", "cause", "driverAdapterError"]) {
    const nested = diagnosticMetadata(record[key], depth + 1);
    if (nested) safe[key] = nested;
  }
  return Object.keys(safe).length ? safe : undefined;
}

export function registrationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return [...new Set(error.issues.map((issue) => issue.message))].join(" ");
  if (error instanceof CalonMuridError || error instanceof PaymentError || error instanceof AuthorizationError) return error.message;
  const code = databaseCode(error);
  if (code && ["P2028", "P2024", "P1001", "P1002", "P1017"].includes(code)) {
    return `Koneksi database sedang sibuk atau melewati batas waktu (${code}). Permintaan belum berhasil; silakan coba kembali. Jika tetap gagal, hubungi panitia.`;
  }
  return fallback;
}

// Raw Prisma message/meta can contain SQL, credentials, personal data or signed
// URLs. Keep error codes and stack call sites, not raw query arguments.
export function registrationErrorDetails(error: unknown) {
  const stack = error instanceof Error ? error.stack?.split("\n").filter((line) => /^\s+at\s/.test(line)).slice(0, 12) : undefined;
  const expected = error instanceof CalonMuridError || error instanceof PaymentError || error instanceof AuthorizationError;
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: expected ? error.code : databaseCode(error),
    message: registrationErrorMessage(error, "Unexpected server error (raw payload omitted for data protection)."),
    stack,
    metadata: diagnosticMetadata(error),
    ...(error instanceof ZodError ? { validation: error.flatten() } : {}),
  };
}
