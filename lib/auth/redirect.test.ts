import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it("menerima path internal", () => {
    expect(safeRedirectPath("/dashboard?tab=anak")).toBe(
      "/dashboard?tab=anak",
    );
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil", null])(
    "menolak redirect tidak aman: %s",
    (value) => {
      expect(safeRedirectPath(value, "/login")).toBe("/login");
    },
  );
});

