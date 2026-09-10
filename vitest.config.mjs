import { defineConfig } from "vitest/config";

// Red de tests del Brain OS (Fase 0). Corre los *.test.mjs de tests/ en Node.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    environment: "node",
  },
});
