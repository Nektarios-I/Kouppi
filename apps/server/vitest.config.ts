import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    // Socket integration tests bind fixed ports; run files sequentially to avoid flakes.
    fileParallelism: false,
  },
});
