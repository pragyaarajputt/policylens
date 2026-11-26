import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashIdentifier } from "@/lib/security/crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limit stored in Postgres, so it works across server instances at no cost.
 * One atomic upsert per call: no race between reading and incrementing the count.
 */
export async function rateLimit(scope: string, identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const key = `${scope}:${hashIdentifier(identifier)}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt: windowEnd } = rows[0];
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: windowEnd };
}

/** Remove expired counters. Called from the daily job. */
export async function pruneRateLimits(now = new Date()) {
  const { count } = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });
  return count;
}

/**
 * The client's IP as seen by our hosting proxy. Proxies append to X-Forwarded-For, so the entry added by
 * our own proxy (counted from the right) can't be forged by the client. TRUSTED_PROXY_HOPS = proxies in front of us.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain[chain.length - hops] ?? h.get("x-real-ip") ?? "unknown";
}

export const LIMITS = {
  signInEmailPerAddress: { limit: 5, windowMs: 60 * 60_000 },
  signInEmailPerIp: { limit: 20, windowMs: 60 * 60_000 },
  uploadsPerUser: { limit: 20, windowMs: 60 * 60_000 },
  // Each analysis sends a whole policy to the free Gemini tier, so keep this modest.
  analysesPerUser: { limit: 10, windowMs: 60 * 60_000 },
  questionsPerUser: { limit: 30, windowMs: 60 * 60_000 },
} as const;
