import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";

describe("auth schemas", () => {
  it("menormalkan email registrasi", () => {
    const result = registerSchema.parse({
      email: "  Wali@Example.com ",
      password: "rahasia123",
      confirmPassword: "rahasia123",
    });

    expect(result.email).toBe("wali@example.com");
  });

  it("menolak password kurang dari delapan karakter", () => {
    const result = registerSchema.safeParse({
      email: "wali@example.com",
      password: "pendek",
      confirmPassword: "pendek",
    });

    expect(result.success).toBe(false);
  });

  it("menolak konfirmasi password yang berbeda", () => {
    const result = resetPasswordSchema.safeParse({
      password: "rahasia123",
      confirmPassword: "berbeda123",
    });

    expect(result.success).toBe(false);
  });

  it("menolak email reset yang tidak valid", () => {
    expect(forgotPasswordSchema.safeParse({ email: "bukan-email" }).success).toBe(
      false,
    );
  });
});

