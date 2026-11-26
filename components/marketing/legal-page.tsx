import { Logo } from "@/components/brand/logo";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-12">
      <Logo />
      <div className="grid gap-1">
        <h1 className="display text-5xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated {updated}.</p>
      </div>
      <div className="grid gap-5 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
