import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Opt-in browser verification: synthetic data, mocked Auth/services, no remote DB.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
  test: { environment: "node", include: ["scripts/registration-recovery.browser.ts"], testTimeout: 60000, hookTimeout: 60000 },
});
