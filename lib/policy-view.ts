import "server-only";
import { notFound } from "next/navigation";
import { isTrusted, type CitationCheck } from "@/lib/citations";
import { getDocument, NotFoundError } from "@/lib/data/documents";
import type { PolicyFacts } from "@/lib/policy-schema";
import { requireUserId } from "@/lib/session";

/** Load an analysed policy for one of its tool pages: facts, which clauses are verified, and their pages. */
export async function loadPolicyTools(id: string) {
  const userId = await requireUserId();
  const doc = await getDocument(userId, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const trustedFields = doc.findings.filter((f) => isTrusted(f.check as CitationCheck)).map((f) => f.field);
  const pageByField = Object.fromEntries(doc.findings.filter((f) => f.page !== null).map((f) => [f.field, f.page as number]));
  const facts = doc.status === "READY" ? (doc.facts as PolicyFacts | null) : null;
  // Analyses from before the calculator lack these facts; re-analysing fills them in.
  const hasToolFacts = Boolean(facts && Array.isArray(facts.copayRules) && Array.isArray(facts.waitingConditions));
  return { doc, facts, trustedFields, pageByField, hasToolFacts, name: doc.planName ?? doc.filename };
}
