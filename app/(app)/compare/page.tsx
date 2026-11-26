import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { isTrusted, type CitationCheck } from "@/lib/citations";
import { getComparison, listReadyDocuments } from "@/lib/data/documents";
import { FIELDS, GROUPS } from "@/lib/fields";
import type { PolicyFacts } from "@/lib/policy-schema";
import { risks } from "@/lib/risks";
import { requireUserId } from "@/lib/session";
import { STATUS_TEXT } from "@/lib/status-style";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compare policies" };

const SUM_INSURED = 500000;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []);

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <p className="eyebrow">Compare</p>
        <h1 className="display text-5xl">
          Side by <em>side</em>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          The same 20 questions for each policy, each answer backed by its clause. PolicyLens shows the differences; it doesn&apos;t pick a
          policy for you.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading policies…</p>}>
        <Compare searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Compare({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const userId = await requireUserId();
  const ids = list(sp.ids);
  const onlyDiff = sp.diff === "1";
  const docs = ids.length >= 2 ? await getComparison(userId, ids) : [];

  if (docs.length < 2) return <Picker userId={userId} selected={ids} />;

  const cell = (d: (typeof docs)[number], key: string) => d.findings.find((f) => f.field === key);
  const differs = (key: string) => new Set(docs.map((d) => cell(d, key)?.status ?? "NOT_MENTIONED")).size > 1;
  const query = docs.map((d) => `ids=${d.id}`).join("&");
  const cols = { gridTemplateColumns: `minmax(9rem, 13rem) repeat(${docs.length}, minmax(0, 1fr))` };
  // Wide enough for every column on a laptop; on a phone the table scrolls sideways inside its box.
  const tableWidth = { minWidth: `${9 + docs.length * 15}rem` };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/compare?${query}${onlyDiff ? "" : "&diff=1"}`}
          aria-pressed={onlyDiff}
          className={cn(
            "rounded-full border px-3 py-1",
            onlyDiff ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/40",
          )}
        >
          Only show differences
        </Link>
        <Link href="/compare" className="rounded-full px-3 py-1 text-muted-foreground hover:text-foreground">
          Choose other policies
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-background/85">
        <div style={tableWidth}>
          <div className="grid border-b bg-background/95" style={cols}>
            <div className="p-4" />
            {docs.map((d) => (
              <div key={d.id} className="grid content-start gap-1 border-l p-4">
                <Link href={`/policies/${d.id}`} className="font-medium hover:text-primary">
                  {d.planName ?? d.filename}
                </Link>
                {d.insurer && <span className="text-sm text-muted-foreground">{d.insurer}</span>}
              </div>
            ))}
          </div>

          <div className="grid border-b" style={cols}>
            <div className="p-4">
              <p className="font-medium">Claim surprises</p>
              <p className="text-xs text-muted-foreground">at ₹5L sum insured</p>
            </div>
            {docs.map((d) => {
              const trusted = (field: string) => {
                const f = cell(d, field);
                return Boolean(f && isTrusted(f.check as CitationCheck));
              };
              const found = d.facts ? risks(d.facts as PolicyFacts, SUM_INSURED, trusted) : [];
              return (
                <ul key={d.id} className="grid content-start gap-1 border-l p-4 text-sm">
                  {found.length === 0 && <li className="text-muted-foreground">None of the common traps in the verified clauses</li>}
                  {found.map((r) => (
                    <li key={r.code} className={cn(r.level === "high" ? "text-destructive" : "text-foreground")}>
                      {r.level === "high" ? "● " : "○ "}
                      {r.title}
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>

          {GROUPS.map((group) => {
            const rows = FIELDS.filter((f) => f.group === group && (!onlyDiff || differs(f.key)));
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-label={group}>
                <h2 className="border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group}</h2>
                {rows.map((field) => (
                  <div key={field.key} className="grid border-b" style={cols}>
                    <div className="grid content-start gap-1 p-4">
                      <p className="font-medium">{field.label}</p>
                      {differs(field.key) && <span className="text-xs text-primary">Differs</span>}
                    </div>
                    {docs.map((d) => {
                      const f = cell(d, field.key);
                      if (!f) return <div key={d.id} className="border-l p-4 text-sm text-muted-foreground">Not analysed</div>;
                      const ok = isTrusted(f.check as CitationCheck);
                      const status = STATUS_TEXT[f.status];
                      return (
                        <div key={d.id} className="grid content-start gap-1.5 border-l p-4 text-sm">
                          <span className={cn("justify-self-start rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>
                            {status.text}
                          </span>
                          {f.status === "NOT_MENTIONED" ? (
                            <span className="text-muted-foreground">The policy doesn&apos;t say.</span>
                          ) : ok ? (
                            <>
                              <span>{f.summary}</span>
                              <Link href={`/policies/${d.id}/clause/${f.page}?f=${field.key}`} className="text-xs text-muted-foreground hover:text-primary">
                                Clause on page {f.page} →
                              </Link>
                            </>
                          ) : (
                            <span className="inline-flex items-start gap-1 text-amber-700 dark:text-amber-300">
                              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Not verified in the PDF
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        A comparison of what each document says, not advice on which policy to buy. Premiums, claim experience and network hospitals
        aren&apos;t in a policy wording.
      </p>
    </div>
  );
}

async function Picker({ userId, selected }: { userId: string; selected: string[] }) {
  const docs = await listReadyDocuments(userId);
  if (docs.length < 2) {
    return (
      <div className="grid max-w-2xl gap-3 rounded-2xl border bg-background/80 p-6">
        <p>You need at least two analysed policies to compare. You have {docs.length}.</p>
        <Link href="/policies" className="justify-self-start text-sm font-medium text-primary">
          Upload a policy →
        </Link>
      </div>
    );
  }
  return (
    <form action="/compare" className="grid max-w-2xl gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium">Choose 2 or 3 policies</legend>
        {docs.map((d) => (
          <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background/80 px-4 py-3 has-checked:border-primary/60">
            <input type="checkbox" name="ids" value={d.id} defaultChecked={selected.includes(d.id)} className="size-4 accent-primary" />
            <span className="font-medium">{d.planName ?? d.filename}</span>
            {d.insurer && <span className="text-sm text-muted-foreground">{d.insurer}</span>}
          </label>
        ))}
      </fieldset>
      {selected.length === 1 && <p className="text-sm text-destructive">Pick at least two.</p>}
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-self-start rounded-full bg-primary px-6 font-medium text-primary-foreground hover:opacity-90"
      >
        Compare
      </button>
      <p className="text-xs text-muted-foreground">If you pick more than three, the first three are compared.</p>
    </form>
  );
}
