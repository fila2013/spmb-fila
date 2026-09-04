import { describe, expect, it } from "vitest";

import {
  authConfirmationUrl,
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
  });

  it("mengirim signup ke login walaupun tautan lama membawa next dashboard", () => {
    expect(confirmationDestination("email", "/dashboard")).toBe(
      "/login?auth=confirmed",
    );
    expect(confirmationDestination("signup", "/")).toBe(
      "/login?auth=confirmed",
    );
  });

  it("mempertahankan session recovery hanya untuk halaman reset password", () => {
    expect(confirmationDestination("recovery", "/reset-password")).toBe(
      "/reset-password",
    );
    expect(callbackConfirmationDestination("/reset-password")).toBe(
      "/reset-password",
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
