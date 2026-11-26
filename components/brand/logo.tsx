import Link from "next/link";
import { cn } from "@/lib/utils";

/** PolicyLens mark: a document under a lens. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={cn("size-7", className)}>
      <path d="M6 3.5h10l5 5v15.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <path d="M9 10h6M9 13.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
      <circle cx="17.5" cy="18.5" r="4" stroke="currentColor" strokeWidth="2.2" className="text-foreground" />
      <path d="m20.5 21.5 3 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-foreground" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 text-[1.35rem] leading-none", className)} aria-label="PolicyLens home">
      <LogoMark />
      <span className="text-primary">
        Policy<span className="font-semibold">Lens</span>
      </span>
    </Link>
  );
}
