import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "./policies/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b print:hidden bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3.5 sm:px-6">
          <Logo href="/policies" />
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <Link href="/policies" className="rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              My policies
            </Link>
            <Link href="/compare" className="rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              Compare
            </Link>
          </nav>
          <form action={signOutAction} className="ml-auto">
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-[10px] border px-3.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="hero-wash print:bg-none mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-6">{children}</main>
    </div>
  );
}
