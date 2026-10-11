import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pinned so the suite never depends on whoever's .env is on disk. Most
    // money tests describe the DESTINATION-charge model, so that's the
    // baseline; direct-charges.test.ts stubs this per-test to cover both
    // branches explicitly.
    env: { VITE_STRIPE_DIRECT_CHARGES: "false" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
