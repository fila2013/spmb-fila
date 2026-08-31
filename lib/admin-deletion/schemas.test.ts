import { describe, expect, it } from "vitest";

import {
  deleteGuardianSchema,
  deleteParticipantSchema,
} from "@/lib/admin-deletion/schemas";

const id = "9b7a0cce-c9df-4cc8-9e65-05e47d170111";

describe("admin deletion schemas", () => {
  it("accepts participant and guardian confirmation payloads", () => {
    expect(
      deleteParticipantSchema.parse({ id, confirmation: "HAPUS Alya" }),
    ).toEqual({ id, confirmation: "HAPUS Alya" });
    expect(
      deleteGuardianSchema.parse({
        id,
        confirmation: "HAPUS wali@example.com",
      }),
    ).toEqual({ id, confirmation: "HAPUS wali@example.com" });
  });

  it("rejects invalid identifiers and blank confirmations", () => {
    expect(
      deleteParticipantSchema.safeParse({ id: "invalid", confirmation: "" })
        .success,
    ).toBe(false);
  });
});
