import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}` },
      // "server-only" throws outside React Server Components; tests run in plain Node.
      { find: /^server-only$/, replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup-db.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: { name: "eval", include: ["tests/evals/**/*.eval.ts"], testTimeout: 600_000 },
      },
    ],
  },
});
