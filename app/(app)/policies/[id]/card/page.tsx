import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { copayText, roomCapPerDay } from "@/lib/claim-calc";
import type { PolicyFacts } from "@/lib/policy-schema";
import { loadPolicyTools } from "@/lib/policy-view";
import { cn } from "@/lib/utils";
import { waitingTimeline } from "@/lib/waiting";
import { PolicyTabs } from "../policy-tabs";
import { ToolGate } from "../tool-gate";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Policy card" };

const SUM_INSURED_OPTIONS = [300000, 500000, 1000000, 2500000];
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n: number) => `₹${n / 100000}L`;
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

interface Row {
  label: string;
  value: string;
  field: string;
  warn?: boolean;
}

/** The card's rows: only from verified clauses, each with its page. */
function rows(f: PolicyFacts, si: number, ok: (field: string) => boolean): Row[] {
  const out: Row[] = [];
  const add = (r: Row) => ok(r.field) && out.push(r);
  const cap = roomCapPerDay(f, si);
  const rr = f.roomRent;
  add({
    label: "Room",
    field: "room_rent",
    value:
      cap !== null
        ? `Choose a room up to ${rupees(cap)}/day${f.proportionateDeduction ? ". A costlier room cuts the whole bill in proportion" : ""}`
        : rr.kind === "ROOM_CATEGORY"
          ? `Covered room: ${rr.roomCategory ?? "see clause"}`
          : rr.kind === "NO_LIMIT"
            ? "No room-rent limit"
            : "Room limit unclear: ask the insurer",
    warn: cap !== null,
  });
  if (f.icuCap) {
    const icu = [f.icuCap.percentOfSumInsured ? (si * f.icuCap.percentOfSumInsured) / 100 : null, f.icuCap.rupeesPerDay].filter((v): v is number => Boolean(v));
    if (icu.length) add({ label: "ICU", field: "icu", value: `Up to ${rupees(Math.min(...icu))}/day` });
  }
  const copays = f.copayRules ?? [];
  if (copays.length) add({ label: "Co-pay", field: "copay", value: copays.map(copayText).join("; "), warn: true });
  else if (f.copayPercent) add({ label: "Co-pay", field: "copay", value: `Up to ${f.copayPercent}%`, warn: true });
  else add({ label: "Co-pay", field: "copay", value: "None" });
  if (f.deductibleRupees) add({ label: "Deductible", field: "deductible", value: `You pay the first ${rupees(f.deductibleRupees)}`, warn: true });
  if (f.consumablesCovered === false) add({ label: "Consumables", field: "consumables", value: "Not paid: expect to pay for gloves, PPE and kits", warn: true });
  if (f.consumablesCovered === true) add({ label: "Consumables", field: "consumables", value: "Paid" });
  if (f.preHospitalisationDays || f.postHospitalisationDays) {
    add({
      label: "Keep bills",
      field: "pre_post_hospitalisation",
      value: `From ${f.preHospitalisationDays ?? 0} days before admission to ${f.postHospitalisationDays ?? 0} days after discharge`,
    });
  }
  if (f.cataractLimit) {
    const c = [f.cataractLimit.percentOfSumInsured ? (si * f.cataractLimit.percentOfSumInsured) / 100 : null, f.cataractLimit.rupeesPerEye].filter((v): v is number => Boolean(v));
    if (c.length) add({ label: "Cataract", field: "sub_limits", value: `Up to ${rupees(Math.min(...c))} per eye`, warn: true });
  }
  if (f.maternityCovered === false) add({ label: "Maternity", field: "maternity", value: "Not covered", warn: true });
  if (f.restoration !== null) add({ label: "Restore cover", field: "restoration", value: f.restoration ? "Sum insured restored after it's used up" : "No restoration" });
  if (f.noClaimBonusPercentPerYear) add({ label: "No-claim bonus", field: "no_claim_bonus", value: `+${f.noClaimBonusPercentPerYear}% cover per claim-free year` });
  return out;
}

export default function CardPage({ params, searchParams }: PageProps<"/policies/[id]/card">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Card params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Card({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await loadPolicyTools(id);
  const si = SUM_INSURED_OPTIONS.includes(Number(sp.si)) ? Number(sp.si) : 500000;
  const ok = (field: string) => p.trustedFields.includes(field);
  const today = new Date();
  const waits =
    p.facts && p.hasToolFacts && p.doc.coverStartDate ? waitingTimeline(p.facts, p.doc.coverStartDate, p.doc.priorCoverMonths ?? 0, today, ok) : null;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 print:hidden">
        <Link href="/policies" className="text-sm text-muted-foreground hover:text-foreground">
          ← My policies
        </Link>
        <header className="grid gap-2">
          <p className="eyebrow">{p.name}</p>
          <h1 className="display text-4xl sm:text-5xl">
            Your policy on <em>one page</em>
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Print it or save it as PDF for the family, or keep it for the hospital admission desk. Only verified clauses are on it.
          </p>
        </header>
        <PolicyTabs id={id} active="card" />
        <ToolGate id={id} status={p.doc.status} hasToolFacts={p.hasToolFacts} />
      </div>

      {p.facts && p.hasToolFacts && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
            <span className="text-muted-foreground">Sum insured</span>
            {SUM_INSURED_OPTIONS.map((v) => (
              <Link
                key={v}
                href={`/policies/${id}/card?si=${v}`}
                scroll={false}
                aria-current={v === si ? "true" : undefined}
                className={cn("rounded-full border px-3 py-1", v === si ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {lakh(v)}
              </Link>
            ))}
            <span className="ml-auto">
              <PrintButton />
            </span>
          </div>

          <article className="grid max-w-3xl gap-5 rounded-2xl border bg-background p-6 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
            <header className="grid gap-1 border-b pb-4">
              <p className="eyebrow">{p.doc.insurer ?? "Health insurance"}</p>
              <h2 className="display text-3xl">{p.name}</h2>
              <p className="text-sm text-muted-foreground">Sum insured {lakh(si)} · Policy card by PolicyLens</p>
            </header>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
              {rows(p.facts, si, ok).map((r) => (
                <div key={r.label} className="contents">
                  <dt className="font-medium">{r.label}</dt>
                  <dd className={cn(r.warn && "text-amber-800 dark:text-amber-300 print:text-black")}>
                    {r.value}
                    {p.pageByField[r.field] && <span className="ml-1.5 text-xs text-muted-foreground">(p.{p.pageByField[r.field]})</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {waits && waits.length > 0 && (
              <section className="grid gap-2 border-t pt-4">
                <h3 className="font-medium">Waiting periods (cover from {dateFmt.format(p.doc.coverStartDate as Date)})</h3>
                <ul className="grid gap-1 text-sm">
                  {waits.map((w) => (
                    <li key={w.key}>
                      {w.label}: {w.coveredNow ? "covered now" : `covered from ${dateFmt.format(w.endsOn)}`}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!waits && (
              <p className="border-t pt-4 text-sm text-muted-foreground print:hidden">
                Add your cover start date in{" "}
                <Link href={`/policies/${id}/timeline`} className="text-primary">
                  Am I covered yet?
                </Link>{" "}
                to put waiting-period dates on this card.
              </p>
            )}
            <footer className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
              From the policy wording, with page numbers. Not insurance advice; the policy and your insurer&apos;s decision are what count. Made{" "}
              {dateFmt.format(today)} with PolicyLens.
            </footer>
          </article>
        </>
      )}
    </div>
  );
}
