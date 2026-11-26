"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateClaim, roomCapPerDay, type ClaimInput } from "@/lib/claim-calc";
import type { PolicyFacts } from "@/lib/policy-schema";
import { cn } from "@/lib/utils";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// A typical 4-day stay in a metro private hospital, so the page shows something useful straight away.
const EXAMPLE: ClaimInput = {
  sumInsured: 500000,
  age: 40,
  days: 4,
  roomRentPerDay: 8000,
  icuDays: 0,
  icuRentPerDay: 0,
  doctorFees: 40000,
  otherHospital: 30000,
  pharmacy: 25000,
  consumables: 6000,
  implants: 0,
  diagnostics: 15000,
  higherZone: false,
  nonNetwork: false,
  cataractEyes: 0,
};

const MONEY_FIELDS: { key: keyof ClaimInput; label: string; hint?: string }[] = [
  { key: "roomRentPerDay", label: "Room rent per day" },
  { key: "doctorFees", label: "Doctor and surgeon fees" },
  { key: "otherHospital", label: "OT, nursing, other charges" },
  { key: "pharmacy", label: "Medicines" },
  { key: "consumables", label: "Consumables", hint: "Gloves, PPE, kits" },
  { key: "implants", label: "Implants and devices", hint: "Stents, lenses, joints" },
  { key: "diagnostics", label: "Tests and scans" },
  { key: "icuRentPerDay", label: "ICU charges per day" },
];

export function ClaimCalculator({
  id,
  facts,
  trustedFields,
  pageByField,
}: {
  id: string;
  facts: PolicyFacts;
  trustedFields: string[];
  pageByField: Record<string, number>;
}) {
  const [input, setInput] = useState<ClaimInput>(EXAMPLE);
  const trusted = useMemo(() => new Set(trustedFields), [trustedFields]);
  const result = useMemo(() => calculateClaim(facts, input, (f) => trusted.has(f)), [facts, input, trusted]);
  const set = <K extends keyof ClaimInput>(key: K, value: ClaimInput[K]) => setInput((s) => ({ ...s, [key]: value }));
  const num = (key: keyof ClaimInput) => ({
    value: String(input[key] || ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, Math.max(0, Number(e.target.value.replace(/[^\d]/g, "")) || 0) as never),
    inputMode: "numeric" as const,
  });
  const clause = (field?: string) =>
    field && pageByField[field] ? (
      <Link href={`/policies/${id}/clause/${pageByField[field]}?f=${field}`} className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline">
        clause, p.{pageByField[field]}
      </Link>
    ) : null;
  const roomCap = trusted.has("room_rent") ? roomCapPerDay(facts, input.sumInsured) : null;
  const share = result.billed > 0 ? Math.round((result.paid / result.billed) * 100) : 0;
  const inputCls = "h-10 w-full rounded-lg border bg-background px-3 text-base tabular-nums outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <form className="grid content-start gap-5" onSubmit={(e) => e.preventDefault()} aria-label="Hospital bill">
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 font-medium">You</legend>
          <label className="grid gap-1 text-sm">
            Sum insured (₹)
            <input className={inputCls} {...num("sumInsured")} />
          </label>
          <label className="grid gap-1 text-sm">
            Age of patient
            <input className={inputCls} {...num("age")} />
          </label>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 font-medium">The stay</legend>
          <label className="grid gap-1 text-sm">
            Days in a room
            <input className={inputCls} {...num("days")} />
          </label>
          <label className="grid gap-1 text-sm">
            Days in ICU
            <input className={inputCls} {...num("icuDays")} />
          </label>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 font-medium">The bill (₹)</legend>
          {MONEY_FIELDS.map((f) => (
            <label key={f.key} className="grid content-start gap-1 text-sm">
              <span>
                {f.label}
                {f.hint && <span className="block text-xs text-muted-foreground">{f.hint}</span>}
              </span>
              <input className={inputCls} {...num(f.key)} />
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-2 font-medium">Situation</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={input.higherZone} onChange={(e) => set("higherZone", e.target.checked)} />
            Treated in a costlier city than my plan&apos;s zone
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={input.nonNetwork} onChange={(e) => set("nonNetwork", e.target.checked)} />
            Hospital is outside the insurer&apos;s network
          </label>
          <label className="flex items-center gap-2">
            Cataract surgery on
            <select
              className="h-9 rounded-lg border bg-background px-2"
              value={input.cataractEyes}
              onChange={(e) => set("cataractEyes", Number(e.target.value) as 0 | 1 | 2)}
            >
              <option value={0}>no eyes (not cataract)</option>
              <option value={1}>one eye</option>
              <option value={2}>both eyes</option>
            </select>
          </label>
        </fieldset>
        <button type="button" onClick={() => setInput(EXAMPLE)} className="justify-self-start text-sm text-muted-foreground hover:text-primary">
          Reset to the example bill
        </button>
      </form>

      <section aria-live="polite" aria-label="What the policy pays" className="grid content-start gap-5">
        <div className="grid gap-4 rounded-2xl border bg-background/90 p-6 sm:grid-cols-3">
          <div>
            <p className="eyebrow">Hospital bill</p>
            <p className="text-2xl font-medium tabular-nums">{rupees(result.billed)}</p>
          </div>
          <div>
            <p className="eyebrow">Policy pays</p>
            <p className="text-2xl font-medium tabular-nums text-primary">{rupees(result.paid)}</p>
            <p className="text-xs text-muted-foreground">{share}% of the bill</p>
          </div>
          <div>
            <p className="eyebrow">You pay</p>
            <p className={cn("text-2xl font-medium tabular-nums", result.youPay > 0 && "text-destructive")}>{rupees(result.youPay)}</p>
          </div>
        </div>

        {roomCap !== null && input.roomRentPerDay > roomCap && facts.proportionateDeduction && (
          <p className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <strong>Tip:</strong> choose a room up to {rupees(roomCap)}/day. With this bill you&apos;d then pay{" "}
            <strong>
              {rupees(
                calculateClaim(facts, { ...input, roomRentPerDay: roomCap }, (f) => trusted.has(f)).youPay,
              )}
            </strong>{" "}
            instead of {rupees(result.youPay)}.
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border bg-background/90">
          <table className="w-full text-sm">
            <caption className="sr-only">Bill items, what is paid, and why</caption>
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 text-right font-medium">Billed</th>
                <th className="px-4 py-2 text-right font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.key} className="border-b align-top last:border-b-0">
                  <td className="px-4 py-3">
                    {l.label}
                    {l.note && (
                      <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
                        {l.note} {clause(l.field)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(l.billed)}</td>
                  <td className={cn("px-4 py-3 text-right tabular-nums", l.paid < l.billed && "text-amber-700 dark:text-amber-300")}>{rupees(l.paid)}</td>
                </tr>
              ))}
              {result.steps.map((s) => (
                <tr key={s.label} className="border-t bg-muted/30 align-top">
                  <td className="px-4 py-3" colSpan={2}>
                    {s.label}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {s.note} {clause(s.field)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-destructive">−{rupees(-s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.warnings.length > 0 && (
          <ul className="grid gap-2 text-sm">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {w.text} {clause(w.field)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          An estimate from this policy&apos;s verified clauses, worked out by fixed rules, not AI. The insurer decides the actual claim, and
          hospitals also bill items most policies never pay (registration, admin, food), which aren&apos;t in this estimate.
        </p>
      </section>
    </div>
  );
}
