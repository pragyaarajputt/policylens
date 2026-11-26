// Apply migrations to the test database (TEST_DATABASE_URL). Usage: npm run db:test:migrate
import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/_test(\?|$)/.test(url)) {
  console.error("TEST_DATABASE_URL must be set and name a *_test database");
  process.exit(1);
}
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: "" },
});
process.exit(result.status ?? 1);
