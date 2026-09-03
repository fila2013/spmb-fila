import { describe, expect, it } from "vitest";

import {
  loginErrorMessage,
  signupErrorMessage,
} from "@/lib/auth/messages";

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

describe("loginErrorMessage", () => {
  it("menjelaskan bahwa email belum dikonfirmasi", () => {
    expect(loginErrorMessage("email_not_confirmed")).toContain(
      "belum dikonfirmasi",
    );
  });

  it("tetap menyamarkan kegagalan login lain", () => {
    expect(loginErrorMessage("invalid_credentials")).toBe(
      "Email atau password tidak sesuai.",
    );
  });
});
