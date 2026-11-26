import Link from "next/link";
import { AnalyseButton } from "./policy-client";

/** Shown instead of a tool when the policy isn't analysed yet, or was analysed before the tool existed. */
export function ToolGate({ id, status, hasToolFacts }: { id: string; status: string; hasToolFacts: boolean }) {
  if (status !== "READY") {
    return (
      <div className="grid gap-3 rounded-2xl border bg-background/80 p-6">
        <p>Analyse this policy first. The tools work from its verified clauses.</p>
        <Link href={`/policies/${id}`} className="justify-self-start text-sm font-medium text-primary">
          Go to the policy →
        </Link>
      </div>
    );
  }
  if (!hasToolFacts) {
    return (
      <div className="grid gap-3 rounded-2xl border bg-background/80 p-6">
        <p>This policy was analysed before this tool existed. Re-analyse it once (about a minute) to read the extra details it needs.</p>
        <AnalyseButton documentId={id} label="Re-analyse this policy" />
      </div>
    );
  }
  return null;
}
