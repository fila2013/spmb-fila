import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { registrationErrorDetails, registrationErrorMessage } from "@/lib/diagnostics/registration-errors";

describe("diagnostik server tanpa payload sensitif", () => {
  it("mempertahankan SQLSTATE dan constraint tanpa membocorkan query, detail row, atau credential", () => {
    const error = Object.assign(new Error("postgresql://user:secret@database.test"), {
      code: "P2010",
      meta: { query: "INSERT private data", driverAdapterError: { cause: { code: "23514", constraint: "quota_capacity_check", detail: "Private Child Name", message: "private" } } },
    });
    const details = registrationErrorDetails(error);
    expect(details.metadata).toMatchObject({ code: "P2010", meta: { driverAdapterError: { cause: { code: "23514", constraint: "quota_capacity_check" } } } });
    const serialized = JSON.stringify(details);
    for (const privateValue of ["secret", "Private Child Name", "INSERT private data"]) expect(serialized).not.toContain(privateValue);
    expect(registrationErrorMessage(error, "Pesan aman")).toBe("Pesan aman");
  });

  it("error yang bukan kontrak domain tidak diteruskan mentah ke UI atau terminal", () => {
    const error = new Error("Token secret-value dan nama/email pengguna");
    expect(registrationErrorMessage(error, "Pesan aman")).toBe("Pesan aman");
    expect(JSON.stringify(registrationErrorDetails(error))).not.toContain(error.message);
  });
});
