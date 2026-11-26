"use client";

import { CalendarPlus, CircleCheck, Clock, Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { PolicyFacts } from "@/lib/policy-schema";
import { cn } from "@/lib/utils";
import { addMonths, findConditions, waitingIcs, waitingTimeline } from "@/lib/waiting";
import { coverDatesAction, type ActionState } from "../../actions";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "in 1 year 4 months" / "in 12 days" */
function until(from: Date, to: Date) {
  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (days < 45) return `in ${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `in ${[y && `${y} year${y > 1 ? "s" : ""}`, m && `${m} month${m > 1 ? "s" : ""}`].filter(Boolean).join(" ")}`;
}

export function CoverDatesForm({ id, start, prior }: { id: string; start: string | null; prior: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(coverDatesAction, {});
  const cls = "h-10 rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";
  return (
    <form action={action} className="grid gap-4 rounded-2xl border bg-background/80 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="documentId" value={id} />
      <label className="grid gap-1 text-sm">
        Cover started on
        <span className="text-xs text-muted-foreground">First day of continuous cover with this insurer</span>
        <input type="date" name="start" required defaultValue={start ?? ""} className={cls} />
      </label>
      <label className="grid gap-1 text-sm">
        Earlier cover carried over (months)
        <span className="text-xs text-muted-foreground">If you ported from another insurer; else 0</span>
        <input type="number" name="prior" min={0} max={600} defaultValue={prior} className={cls} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : start ? "Update" : "Show my dates"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function TimelineView({
  id,
  name,
  facts,
  trustedFields,
  pageByField,
  start,
  prior,
}: {
  id: string;
  name: string;
  facts: PolicyFacts;
  trustedFields: string[];
  pageByField: Record<string, number>;
  start: string;
  prior: number;
}) {
  const [query, setQuery] = useState("");
  const today = useMemo(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }, []);
  const startDate = useMemo(() => new Date(`${start}T00:00:00Z`), [start]);
  const trusted = useMemo(() => new Set(trustedFields), [trustedFields]);
  const items = useMemo(() => waitingTimeline(facts, startDate, prior, today, (f) => trusted.has(f)), [facts, startDate, prior, today, trusted]);
  const matches = useMemo(() => findConditions(facts, query), [facts, query]);
  const pedMonths = trusted.has("ped_waiting") ? facts.pedWaitingMonths : null;
  const future = items.filter((i) => !i.coveredNow);

  function downloadIcs() {
    const blob = new Blob([waitingIcs(name, items)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "policylens-waiting-periods.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid gap-8">
      <ol className="grid gap-3">
        {items.map((i) => (
          <li key={i.key} className={cn("grid gap-1 rounded-2xl border p-5 sm:grid-cols-[1fr_auto] sm:items-center", i.coveredNow ? "bg-background/80" : "border-amber-500/40 bg-amber-500/5")}>
            <div className="grid gap-1">
              <p className="font-medium">{i.label}</p>
              <p className="text-sm text-muted-foreground">
                {i.length} wait{i.note ? ` · ${i.note}` : ""}
                {pageByField[i.field] && (
                  <>
                    {" · "}
                    <Link href={`/policies/${id}/clause/${pageByField[i.field]}?f=${i.field}`} className="hover:text-primary">
                      clause, p.{pageByField[i.field]}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <p className={cn("inline-flex items-center gap-1.5 text-sm font-medium", i.coveredNow ? "text-primary" : "text-amber-700 dark:text-amber-300")}>
              {i.coveredNow ? <CircleCheck className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
              {i.coveredNow ? `Covered since ${dateFmt.format(i.endsOn)}` : `Covered from ${dateFmt.format(i.endsOn)} (${until(today, i.endsOn)})`}
            </p>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">No verified waiting periods in this policy.</li>}
      </ol>

      {future.length > 0 && (
        <button
          type="button"
          onClick={downloadIcs}
          className="inline-flex items-center gap-2 justify-self-start rounded-full border px-4 py-2 text-sm hover:border-primary/40 hover:text-primary"
        >
          <CalendarPlus className="size-4" aria-hidden="true" /> Add {future.length === 1 ? "this date" : `these ${future.length} dates`} to my calendar (.ics)
        </button>
      )}

      <section aria-labelledby="lookup-heading" className="grid gap-3">
        <h2 id="lookup-heading" className="display text-3xl">
          Is <em>my</em> condition covered yet?
        </h2>
        <label className="relative max-w-xl">
          <span className="sr-only">Condition or surgery</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. hernia, knee replacement, kidney stone, cataract"
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>
        {query.trim().length >= 3 && (
          <div className="grid max-w-xl gap-2 text-sm" aria-live="polite">
            {matches.map((m) => {
              const ends = addMonths(startDate, Math.max(0, m.months - prior));
              const ok = ends <= today;
              return (
                <p key={m.condition} className="rounded-xl border bg-background/80 p-4">
                  <strong>{m.condition}</strong>: listed with a {m.months}-month wait.{" "}
                  <span className={ok ? "text-primary" : "text-amber-700 dark:text-amber-300"}>
                    {ok ? `Covered since ${dateFmt.format(ends)}.` : `Covered from ${dateFmt.format(ends)} (${until(today, ends)}).`}
                  </span>
                </p>
              );
            })}
            {matches.length === 0 && (
              <p className="rounded-xl border bg-background/80 p-4">
                Not in this policy&apos;s list of conditions with a special waiting period. If you had it <em>before</em> buying the policy,
                the pre-existing disease wait applies{pedMonths ? ` (${pedMonths} months)` : ""}. Otherwise only the first-30-days wait applies.
                Check the exclusions too.
              </p>
            )}
          </div>
        )}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Dates are worked out from what you entered and the policy&apos;s verified waiting periods. Waits restart on a break in cover, and a
        higher sum insured has its own waits on the extra amount. Confirm with your insurer before planning treatment.
      </p>
    </div>
  );
}
