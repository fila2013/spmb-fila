import { describe, expect, it } from "vitest";

import { signupErrorMessage } from "@/lib/auth/messages";

describe("signupErrorMessage", () => {
  it("memberi arahan untuk kegagalan SMTP", () => {
    expect(signupErrorMessage("unexpected_failure")).toContain("SMTP");
  });

  it("tidak menampilkan detail internal untuk kode tidak dikenal", () => {
    expect(signupErrorMessage("internal-detail")).toBe(
      "Akun belum dapat dibuat. Coba kembali beberapa saat lagi.",
    );
  });
});

