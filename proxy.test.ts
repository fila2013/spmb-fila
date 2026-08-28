import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

describe("Supabase session proxy matcher", () => {
  it("menjalankan proxy untuk halaman aplikasi", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/pendaftaran",
      }),
    ).toBe(true);
  });

  it.each(["/_next/static/chunks/app.js", "/logo.svg", "/foto.webp"])(
    "melewati asset statis %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(false);
    },
  );
});
