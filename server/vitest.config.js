import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/tests/setup.js"],
    testTimeout: 15000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});