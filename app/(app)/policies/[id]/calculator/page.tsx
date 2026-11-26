import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadPolicyTools } from "@/lib/policy-view";
import { PolicyTabs } from "../policy-tabs";
import { ToolGate } from "../tool-gate";
import { ClaimCalculator } from "./claim-calculator";

export const metadata: Metadata = { title: "Claim calculator" };

export default function CalculatorPage({ params }: PageProps<"/policies/[id]/calculator">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Calculator params={params} />
    </Suspense>
  );
}

async function Calculator({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadPolicyTools(id);
  return (
    <div className="grid gap-6">
      <Link href="/policies" className="text-sm text-muted-foreground hover:text-foreground">
        ← My policies
      </Link>
      <header className="grid gap-2">
        <p className="eyebrow">{p.name}</p>
        <h1 className="display text-4xl sm:text-5xl">
          What would this policy <em>actually</em> pay?
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Put in a hospital bill. Every rupee cut is traced to the clause that cuts it: room-rent limits, proportionate deduction,
          co-pay, deductibles and sub-limits.
        </p>
      </header>
      <PolicyTabs id={id} active="calculator" />
      <ToolGate id={id} status={p.doc.status} hasToolFacts={p.hasToolFacts} />
      {p.facts && p.hasToolFacts && <ClaimCalculator id={id} facts={p.facts} trustedFields={p.trustedFields} pageByField={p.pageByField} />}
    </div>
  );
}
