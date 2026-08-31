import { describe, expect, it } from "vitest";

import { AdminDeletionError } from "@/lib/admin-deletion/errors";
import {
  assertDeletionConfirmed,
  assertGuardianHasNoChildren,
  deletionConfirmation,
} from "@/lib/admin-deletion/rules";

describe("admin deletion rules", () => {
  it("requires an exact, case-sensitive deletion phrase", () => {
    expect(deletionConfirmation("Alya")).toBe("HAPUS Alya");
  });

  it("accepts the exact participant confirmation", () => {
    expect(() => assertDeletionConfirmed("Alya", "HAPUS Alya")).not.toThrow();
  });

  it("rejects a mismatched confirmation", () => {
    expect(() => assertDeletionConfirmed("Alya", "hapus Alya")).toThrowError(
      expect.objectContaining<Partial<AdminDeletionError>>({
        code: "DELETE_CONFIRMATION_REQUIRED",
        status: 409,
      }),
    );
  });

  it("blocks guardian deletion until every child has been removed", () => {
    expect(() => assertGuardianHasNoChildren(2)).toThrowError(
      expect.objectContaining<Partial<AdminDeletionError>>({
        code: "GUARDIAN_HAS_CHILDREN",
        status: 409,
      }),
    );
    expect(() => assertGuardianHasNoChildren(0)).not.toThrow();
  });
});
