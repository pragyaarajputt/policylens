import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "coverage", label: "Coverage", path: "" },
  { key: "calculator", label: "Claim calculator", path: "/calculator" },
  { key: "timeline", label: "Am I covered yet?", path: "/timeline" },
  { key: "card", label: "Policy card", path: "/card" },
] as const;

export type PolicyTab = (typeof TABS)[number]["key"];

export function PolicyTabs({ id, active }: { id: string; active: PolicyTab }) {
  return (
    <nav aria-label="Policy tools" className="-mx-1 flex gap-1 overflow-x-auto pb-1 print:hidden">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/policies/${id}${t.path}`}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            t.key === active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
