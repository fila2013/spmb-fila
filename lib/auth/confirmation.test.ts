import { describe, expect, it } from "vitest";

import {
  authConfirmationUrl,
  authCodeCallbackPath,
  callbackConfirmationDestination,
  confirmationDestination,
  isAuthReturnPath,
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
    expect(confirmationDestination("email")).toBe(
      "/login?auth=confirmed",
    );
    expect(confirmationDestination("signup")).toBe(
      "/login?auth=confirmed",
    );
  });

  it("mempertahankan session hanya jika Supabase menandai recovery", () => {
    expect(confirmationDestination("recovery")).toBe(
      "/reset-password",
    );
    expect(callbackConfirmationDestination("recovery")).toBe(
      "/reset-password",
    );
    expect(authCodeCallbackPath("abc 123", "flow_1234")).toBe(
      "/auth/callback?code=abc+123&sb_flow_id=flow_1234",
    );
  });

  it("tidak menerima tujuan callback lain setelah konfirmasi akun", () => {
    expect(callbackConfirmationDestination(null)).toBe(
      "/login?auth=confirmed",
    );
    expect(callbackConfirmationDestination("signup")).toBe(
      "/login?auth=confirmed",
    );
    expect(callbackConfirmationDestination("https://evil.example")).toBe(
      "/login?auth=confirmed",
    );
  });

  it("hanya menangkap authorization code pada halaman auth publik", () => {
    expect(isAuthReturnPath("/register")).toBe(true);
    expect(isAuthReturnPath("/auth/confirm")).toBe(true);
    expect(isAuthReturnPath("/admin/peserta")).toBe(false);
  });
});
