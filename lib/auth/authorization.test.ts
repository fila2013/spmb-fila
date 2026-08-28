import { describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/enums";
import { assertOwnership, assertRole } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";

describe("authorization guards", () => {
  const wali = { userId: "wali-1", role: UserRole.WALI_MURID };

  it("mengizinkan role yang sesuai", () => {
    expect(() => assertRole(wali, UserRole.WALI_MURID)).not.toThrow();
  });

  it("menolak role yang berbeda", () => {
    expect(() => assertRole(wali, UserRole.ADMIN)).toThrow(AuthorizationError);
  });

  it("mengizinkan pemilik data", () => {
    expect(() => assertOwnership(wali, "wali-1")).not.toThrow();
  });

  it("menolak akses lintas pemilik", () => {
    expect(() => assertOwnership(wali, "wali-2")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
});

