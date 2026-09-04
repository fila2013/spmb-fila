import { describe, expect, it } from "vitest";

import {
  authConfirmationUrl,
  authCodeCallbackPath,
  callbackConfirmationDestination,
  confirmationDestination,
} from "@/lib/auth/confirmation";

describe("auth confirmation destination", () => {
  it("menormalkan URL konfirmasi dengan atau tanpa trailing slash", () => {
    expect(authConfirmationUrl("https://spmb.example.com")).toBe(
      "https://spmb.example.com/auth/confirm",
    );
    expect(authConfirmationUrl("https://spmb.example.com/")).toBe(
      "https://spmb.example.com/auth/confirm",
    );
    expect(authConfirmationUrl("https://spmb.example.com/", true)).toBe(
      "https://spmb.example.com/auth/confirm?next=%2Freset-password",
    );
  });

  it("mengirim signup ke login walaupun tautan lama membawa next dashboard", () => {
    expect(confirmationDestination("email")).toBe(
      "/login?auth=confirmed",
    );
    expect(confirmationDestination("signup")).toBe(
      "/login?auth=confirmed",
    );
  });

  it("mempertahankan session recovery hanya untuk halaman reset password", () => {
    expect(confirmationDestination("recovery")).toBe(
      "/reset-password",
    );
    expect(callbackConfirmationDestination("/reset-password")).toBe(
      "/reset-password",
    );
    expect(authCodeCallbackPath("abc 123", true)).toBe(
      "/auth/callback?code=abc+123&next=%2Freset-password",
    );
  });

  it("tidak menerima tujuan callback lain setelah konfirmasi akun", () => {
    expect(callbackConfirmationDestination("/dashboard")).toBe(
      "/login?auth=confirmed",
    );
    expect(callbackConfirmationDestination("https://evil.example")).toBe(
      "/login?auth=confirmed",
    );
  });
});
