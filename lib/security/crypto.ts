// Field-level encryption for sensitive identifiers (PAN). AES-256-GCM: confidential and tamper-evident.
// Format: "enc:v1:<iv>:<tag>:<ciphertext>" (base64). The version lets us rotate keys later.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return buf;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt a value. Plain values written before encryption was added are returned unchanged. */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

export const encryptOptional = (v: string | null | undefined) => (v ? encryptField(v) : null);

/** "ABCDE1234F" -> "AB••••••4F". For anyone who isn't an owner. */
export function maskPan(pan: string | null | undefined): string {
  if (!pan) return "";
  return pan.length <= 4 ? "••••" : `${pan.slice(0, 2)}${"•".repeat(pan.length - 4)}${pan.slice(-2)}`;
}

/** One-way hash for rate-limit keys, so stored keys never contain raw IPs or emails. */
export function hashIdentifier(value: string): string {
  const salt = process.env.AUTH_SECRET ?? "creatordesk";
  return createHash("sha256").update(`${salt}:${value.toLowerCase()}`).digest("base64url").slice(0, 32);
}
