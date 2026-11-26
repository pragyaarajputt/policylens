import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadPolicyTools } from "@/lib/policy-view";
import { PolicyTabs } from "../policy-tabs";
import { ToolGate } from "../tool-gate";
import { CoverDatesForm, TimelineView } from "./timeline-view";

export const metadata: Metadata = { title: "Am I covered yet?" };

export default function TimelinePage({ params }: PageProps<"/policies/[id]/timeline">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Timeline params={params} />
    </Suspense>
  );
}

async function Timeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadPolicyTools(id);
  const start = p.doc.coverStartDate ? p.doc.coverStartDate.toISOString().slice(0, 10) : null;
  const prior = p.doc.priorCoverMonths ?? 0;
  return (
    <div className="grid gap-6">
      <Link href="/policies" className="text-sm text-muted-foreground hover:text-foreground">
        ← My policies
      </Link>
      <header className="grid gap-2">
        <p className="eyebrow">{p.name}</p>
        <h1 className="display text-4xl sm:text-5xl">
          Am I covered <em>yet</em>?
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          The exact date each waiting period ends for you, from when your cover started. Search any condition to see when it&apos;s covered.
        </p>
      </header>
      <PolicyTabs id={id} active="timeline" />
      <ToolGate id={id} status={p.doc.status} hasToolFacts={p.hasToolFacts} />
      {p.facts && p.hasToolFacts && (
        <>
          <CoverDatesForm id={id} start={start} prior={prior} />
          {start && (
            <TimelineView
              id={id}
              name={p.name}
              facts={p.facts}
              trustedFields={p.trustedFields}
              pageByField={p.pageByField}
              start={start}
              prior={prior}
            />
          )}
        </>
      )}
    </div>
  );
}
