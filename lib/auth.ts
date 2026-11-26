import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Passwordless email login for local development only. Never active in production builds.
export const devLoginEnabled =
  process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const googleLoginEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Email magic link through Resend (free tier). Works in production; no password to store or leak.
export const emailLoginEnabled = Boolean(process.env.AUTH_RESEND_KEY);

const providers: NextAuthConfig["providers"] = [];
if (googleLoginEnabled) providers.push(Google);
if (emailLoginEnabled) {
  providers.push(Resend({ from: process.env.RESEND_FROM ?? "PolicyLens <onboarding@resend.dev>" }));
}
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const parsed = z.email().safeParse(credentials?.email);
        if (!parsed.success) return null;
        const email = parsed.data.toLowerCase();
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  // JWT sessions (required by the credentials provider). Short-lived: 7 days, refreshed daily while in use.
  // Membership is re-checked on every request, so removing someone takes effect immediately anyway.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers,
  pages: { signIn: "/login", verifyRequest: "/login?check=email" },
  callbacks: {
    // Invites are granted by email address, so only accept Google accounts whose email Google has verified.
    signIn({ account, profile }) {
      if (account?.provider === "google") return profile?.email_verified === true;
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
