import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/db/**/*.spec.ts", "test/notify/match.spec.ts"],
    environment: "node",
  },
});
