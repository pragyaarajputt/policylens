import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { devLoginEnabled, emailLoginEnabled, googleLoginEnabled, signIn } from "@/lib/auth";
import { clientIp, LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { TextField } from "@/components/app/field";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="hero-wash mx-auto grid w-full max-w-sm flex-1 content-center gap-6 px-4 py-12">
      <div className="grid gap-1">
        <Logo className="mb-8" />
        <p className="eyebrow">Welcome back</p>
        <h1 className="display text-5xl">
          Sign <em>in.</em>
        </h1>
      </div>

      {googleLoginEnabled && (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/policies" });
          }}
        >
          <Button type="submit" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      )}

      <Suspense fallback={null}>
        <CheckEmailNotice searchParams={searchParams} />
      </Suspense>

      {emailLoginEnabled && (
        <form
          className="grid gap-3"
          action={async (form: FormData) => {
            "use server";
            const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
            if (!email.success) redirect("/login?error=InvalidEmail");
            // Stop the sign-in form being used to spam an inbox or burn our email quota.
            const [perAddress, perIp] = await Promise.all([
              rateLimit("signin-email", email.data, LIMITS.signInEmailPerAddress.limit, LIMITS.signInEmailPerAddress.windowMs),
              rateLimit("signin-ip", await clientIp(), LIMITS.signInEmailPerIp.limit, LIMITS.signInEmailPerIp.windowMs),
            ]);
            if (!perAddress.allowed || !perIp.allowed) redirect("/login?error=TooManyRequests");
            await signIn("resend", { email: email.data, redirectTo: "/policies" });
          }}
        >
          <TextField label="Email" name="email" type="email" required autoComplete="email" />
          <Button type="submit" variant="outline" size="lg">
            Email me a sign-in link
          </Button>
        </form>
      )}

      {devLoginEnabled && (
        <form
          className="grid gap-3 rounded-lg border border-dashed p-4"
          action={async (form: FormData) => {
            "use server";
            await signIn("dev", { email: form.get("email"), redirectTo: "/policies" });
          }}
        >
          <p className="text-xs text-muted-foreground">Development only: sign in with any email, no password.</p>
          <TextField label="Email" name="email" type="email" required autoComplete="off" />
          <Button type="submit" variant="outline" size="lg">
            Dev sign in
          </Button>
        </form>
      )}

      {!googleLoginEnabled && !emailLoginEnabled && !devLoginEnabled && (
        <p className="text-sm text-muted-foreground">No sign-in method is configured yet.</p>
      )}
    </main>
  );
}

async function CheckEmailNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { check, error } = await searchParams;
  if (check === "email") {
    return (
      <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
        Check your inbox for a sign-in link. It works once and expires in 24 hours.
      </p>
    );
  }
  if (error === "TooManyRequests") {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
        Too many sign-in emails requested. Wait a while, then try again.
      </p>
    );
  }
  if (error === "SessionEnded") {
    return (
      <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
        Your session has ended. Please sign in again.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
        That sign-in didn&apos;t work. The link may have expired. Try again.
      </p>
    );
  }
  return null;
}
