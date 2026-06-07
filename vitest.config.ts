import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for pure modules. The "@/..." alias mirrors tsconfig so tests can
// import app code directly. Keep tests free of server-only / DB / Next imports.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
