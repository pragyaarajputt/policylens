import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** The signed-in user's id, or a redirect to sign in. Every data function filters by this id. */
export async function requireUserId(): Promise<string> {
  // The session is request data: mark it before Auth.js touches crypto (Cache Components).
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  // A deleted account's token may still be unexpired; treat it as signed out.
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) redirect("/login?error=SessionEnded");
  return userId;
}
