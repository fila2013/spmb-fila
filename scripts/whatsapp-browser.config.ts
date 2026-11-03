import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Opt-in Chromium smoke tests. All HTTP requests are intercepted.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["scripts/whatsapp-drafts.browser.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
