import type { Metadata } from "next";
import { CircleAlert, CircleCheck, FileText, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isGrounded, type Citation } from "@/lib/ai/answer-question";
import { isTrusted, type CitationCheck } from "@/lib/citations";
import { getDocument, NotFoundError } from "@/lib/data/documents";
import { FIELDS, GROUPS } from "@/lib/fields";
import type { PolicyFacts } from "@/lib/policy-schema";
import { risks, type RiskLevel } from "@/lib/risks";
import { requireUserId } from "@/lib/session";
import { STATUS_TEXT } from "@/lib/status-style";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../status-badge";
import { AskForm } from "./ask-form";
import { AnalyseButton, DeletePolicyButton } from "./policy-client";
import { PolicyTabs } from "./policy-tabs";

export const metadata: Metadata = { title: "Policy" };

const SUM_INSURED_OPTIONS = [300000, 500000, 1000000, 2500000];
const lakh = (n: number) => `₹${n / 100000}L`;

const RISK_STYLE: Record<RiskLevel, string> = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-border bg-muted/40",
};

export default function PolicyPage({ params, searchParams }: PageProps<"/policies/[id]">) {
  return (
    <div className="grid gap-6">
      <Link href="/policies" className="text-sm text-muted-foreground hover:text-foreground">
        ← My policies
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading policy…</p>}>
        <Policy params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Policy({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = await requireUserId();
  const doc = await getDocument(userId, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const si = SUM_INSURED_OPTIONS.includes(Number(sp.si)) ? Number(sp.si) : 500000;
  const byField = new Map(doc.findings.map((f) => [f.field, f]));
  const trusted = (field: string) => {
    const f = byField.get(field);
    return Boolean(f && isTrusted(f.check as CitationCheck));
  };
  const facts = doc.facts as PolicyFacts | null;
  const warnings = facts ? risks(facts, si, trusted) : [];
  const verifiedCount = doc.findings.filter((f) => isTrusted(f.check as CitationCheck)).length;
  const citedCount = doc.findings.filter((f) => f.check !== "NONE").length;

  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">{doc.insurer ?? "Health insurance policy"}</p>
          <StatusBadge status={doc.status} />
        </div>
        <h1 className="display text-4xl sm:text-5xl">{doc.planName ?? doc.filename}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <a href={`/policies/${doc.id}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-primary">
            <FileText className="size-4" aria-hidden="true" /> {doc.filename} · {doc.pageCount} pages
          </a>
          {doc.status === "READY" && (
            <span>
              {verifiedCount} of {citedCount} answers verified against the PDF
            </span>
          )}
          <DeletePolicyButton documentId={doc.id} />
        </div>
      </header>

      {doc.status === "READY" && <PolicyTabs id={doc.id} active="coverage" />}

      {(doc.status === "UPLOADED" || doc.status === "FAILED" || doc.status === "ANALYSING") && (
        <section className="grid gap-3 rounded-2xl border bg-background/80 p-6">
          {doc.status === "FAILED" && <p className="text-sm text-destructive">Last attempt failed: {doc.error}</p>}
          <p className="text-base">
            PolicyLens will read all {doc.pageCount} pages and answer 20 questions about your cover, each with the clause it comes from.
          </p>
          <AnalyseButton documentId={doc.id} label={doc.status === "FAILED" ? "Try again" : "Analyse this policy"} />
        </section>
      )}

      {doc.status === "SCANNED" && (
        <section className="rounded-2xl border border-destructive/40 p-6 text-sm">
          {doc.error} Most insurers publish the policy wording as a text PDF on their website.
        </section>
      )}

      {doc.status === "READY" && (
        <>
          <section aria-labelledby="risks-heading" className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="risks-heading" className="display text-3xl">
                Claim <em>surprises</em>
              </h2>
              <nav aria-label="Sum insured" className="flex flex-wrap items-center gap-1 text-sm">
                <span className="mr-1 text-muted-foreground">Your sum insured</span>
                {SUM_INSURED_OPTIONS.map((v) => (
                  <Link
                    key={v}
                    href={`/policies/${doc.id}?si=${v}`}
                    scroll={false}
                    aria-current={v === si ? "true" : undefined}
                    className={cn("rounded-full border px-3 py-1", v === si ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
                  >
                    {lakh(v)}
                  </Link>
                ))}
              </nav>
            </div>
            {warnings.length === 0 ? (
              <p className="rounded-2xl border bg-background/80 p-5 text-sm">
                No common claim traps found in the verified clauses. Still read the exclusions in the policy.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {warnings.map((w) => (
                  <li key={w.code} className={cn("grid content-start gap-1.5 rounded-2xl border p-5", RISK_STYLE[w.level])}>
                    <span className="eyebrow">{w.level} risk</span>
                    <span className="font-medium">{w.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{w.explain}</span>
                    {byField.get(w.field)?.page && (
                      <Link href={`/policies/${doc.id}/clause/${byField.get(w.field)?.page}?f=${w.field}`} className="text-sm text-primary">
                        See the clause, page {byField.get(w.field)?.page} →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {GROUPS.map((group) => (
            <section key={group} aria-labelledby={`g-${group}`} className="grid gap-3">
              <h2 id={`g-${group}`} className="display text-3xl">
                {group}
              </h2>
              <ul className="divide-y rounded-2xl border bg-background/80">
                {FIELDS.filter((f) => f.group === group).map((field) => {
                  const f = byField.get(field.key);
                  if (!f) return null;
                  const ok = isTrusted(f.check as CitationCheck);
                  const status = STATUS_TEXT[f.status];
                  return (
                    <li key={field.key} className="grid gap-2 px-5 py-4 md:grid-cols-[14rem_1fr] md:gap-6">
                      <div className="flex items-start justify-between gap-2 md:block">
                        <p className="font-medium">{field.label}</p>
                        <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>{status.text}</span>
                      </div>
                      <div className="grid gap-2">
                        {f.status === "NOT_MENTIONED" ? (
                          <p className="text-sm text-muted-foreground">The policy doesn&apos;t say. Ask the insurer before relying on it.</p>
                        ) : (
                          <p className={cn("text-base", !ok && "text-muted-foreground line-through decoration-muted-foreground/40")}>{f.summary}</p>
                        )}
                        {f.quote && ok && (
                          <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                            “{f.quote}”
                            <span className="mt-1 flex flex-wrap items-center gap-x-3 not-italic">
                              <span className="inline-flex items-center gap-1 text-primary">
                                <CircleCheck className="size-3.5" aria-hidden="true" />
                                {f.check === "MOVED" ? "Verified (page corrected)" : "Verified in the PDF"}
                              </span>
                              <Link href={`/policies/${doc.id}/clause/${f.page}?f=${field.key}`} className="hover:text-primary">
                                Show on page {f.page} →
                              </Link>
                            </span>
                          </blockquote>
                        )}
                        {f.check === "NOT_FOUND" && (
                          <p className="inline-flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            We couldn&apos;t find the AI&apos;s quote in the policy, so we&apos;re not showing this as fact. Check the policy yourself.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section aria-labelledby="ask-heading" className="grid gap-4">
            <h2 id="ask-heading" className="display text-3xl">
              Ask <em>this</em> policy
            </h2>
            <p className="text-sm text-muted-foreground">Answers come only from this document, with the clause they rely on. If the policy doesn&apos;t say, we tell you.</p>
            <AskForm documentId={doc.id} />
            {doc.questions.length > 0 && (
              <ul className="grid gap-3">
                {doc.questions.map((q) => {
                  const citations = q.citations as unknown as Citation[];
                  const grounded = isGrounded({ answerable: q.answerable, citations });
                  return (
                    <li key={q.id} className="grid gap-2 rounded-2xl border bg-background/80 p-5">
                      <p className="inline-flex items-start gap-2 font-medium">
                        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        {q.question}
                      </p>
                      <p className={cn("text-base", q.answerable && !grounded && "text-muted-foreground line-through decoration-muted-foreground/40")}>{q.answer}</p>
                      {q.answerable && !grounded && (
                        <p className="inline-flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          We couldn&apos;t find the AI&apos;s quotes in the policy, so this isn&apos;t shown as fact.
                        </p>
                      )}
                      {citations
                        .map((c, i) => ({ c, i }))
                        .filter(({ c }) => isTrusted(c.check))
                        .map(({ c, i }) => (
                          <blockquote key={i} className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                            “{c.quote}”
                            <span className="mt-1 flex flex-wrap items-center gap-x-3">
                              <span className="inline-flex items-center gap-1 text-primary">
                                <CircleCheck className="size-3.5" aria-hidden="true" /> Verified in the PDF
                              </span>
                              <Link href={`/policies/${doc.id}/clause/${c.page}?q=${q.id}&c=${i}`} className="hover:text-primary">
                                Show on page {c.page} →
                              </Link>
                            </span>
                          </blockquote>
                        ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-xs leading-relaxed text-muted-foreground">
            PolicyLens explains what this document says. It isn&apos;t insurance advice and doesn&apos;t recommend policies. Read with
            {doc.model ? ` ${doc.model}` : " AI"}; every quote shown as verified was matched against the PDF text.
          </p>
        </>
      )}
    </div>
  );
}
