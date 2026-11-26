import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Hosted Postgres with a pooler (Neon) gives a direct URL for migrations.
    url: process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL"),
  },
});
