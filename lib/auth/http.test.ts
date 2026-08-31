import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/auth/errors";
import { authorizationErrorResponse } from "@/lib/auth/http";

describe("authorization HTTP contract", () => {
  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["INACTIVE_PROFILE", 403],
    ["RESOURCE_NOT_FOUND", 404],
  ] as const)("memetakan %s menjadi %i", async (code, status) => {
    const response = authorizationErrorResponse(new AuthorizationError(code, "Pesan aman."));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: { code, message: "Pesan aman." } });
  });

  it("menyembunyikan detail error internal", async () => {
    const response = authorizationErrorResponse(new Error("database secret"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan." },
    });
  });
});
