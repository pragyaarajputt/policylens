// "Am I covered yet?": the date each waiting period ends, from when your cover started.
// Plain date arithmetic over the verified facts. Portability credit reduces waits by the months already served.
import { normalise } from "@/lib/citations";
import type { PolicyFacts } from "@/lib/policy-schema";

export interface WaitItem {
  key: string;
  label: string;
  /** Length of the wait as written in the policy. */
  length: string;
  endsOn: Date;
  coveredNow: boolean;
  field: string;
  note?: string;
}

/** Add calendar months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return out;
}

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function waitingTimeline(
  f: PolicyFacts,
  coverStart: Date,
  priorCoverMonths: number,
  today: Date,
  trusted: (field: string) => boolean,
): WaitItem[] {
  const credit = Math.max(0, Math.floor(priorCoverMonths || 0));
  const items: WaitItem[] = [];
  const months = (key: string, label: string, field: string, m: number | null | undefined, note?: string) => {
    if (m === null || m === undefined || !trusted(field)) return;
    const remaining = Math.max(0, m - credit);
    const endsOn = addMonths(coverStart, remaining);
    items.push({
      key,
      label,
      length: plural(m, "month"),
      endsOn,
      coveredNow: endsOn <= today,
      field,
      note: [note, credit > 0 && m > 0 ? `${plural(Math.min(credit, m), "month")} credited from earlier cover` : null].filter(Boolean).join(" · ") || undefined,
    });
  };

  if (f.initialWaitingDays !== null && trusted("initial_waiting")) {
    // Continuous earlier cover usually waives the first-30-days wait (most wordings say "more than 12 months").
    const waived = credit > 12;
    const endsOn = waived ? coverStart : addDays(coverStart, f.initialWaitingDays);
    items.push({
      key: "initial",
      label: "Any illness (accidents are covered from day one)",
      length: plural(f.initialWaitingDays, "day"),
      endsOn,
      coveredNow: endsOn <= today,
      field: "initial_waiting",
      note: waived ? "Usually waived after more than 12 months of earlier cover: confirm with your insurer" : undefined,
    });
  }
  // Policies often have several lists (24 and 36 months): one row per list, with examples, so nobody reads the longest
  // wait as applying to everything.
  const lists = [...new Set((f.waitingConditions ?? []).map((c) => c.months))].sort((a, b) => a - b);
  if (lists.length > 0) {
    for (const m of lists) {
      const examples = (f.waitingConditions ?? []).filter((c) => c.months === m).map((c) => c.condition);
      const shown = examples.slice(0, 3).join(", ") + (examples.length > 3 ? `, and ${examples.length - 3} more` : "");
      months(lists.length > 1 ? `specific-${m}` : "specific", `Listed illnesses and surgeries (${m}-month list)`, "specific_disease_waiting", m, shown);
    }
  } else {
    months("specific", "Listed illnesses and surgeries", "specific_disease_waiting", f.specificDiseaseWaitingMonths);
  }
  months("ped", "Illnesses you had before buying (pre-existing)", "ped_waiting", f.pedWaitingMonths);
  if (f.maternityCovered) months("maternity", "Maternity", "maternity", f.maternityWaitingMonths ?? null);
  return items.sort((a, b) => a.endsOn.getTime() - b.endsOn.getTime());
}

/** Everyday words people search with, mapped to the words policies use. */
const ALIASES: Record<string, string[]> = {
  knee: ["joint replacement", "knee"],
  hip: ["joint replacement", "hip"],
  "kidney stone": ["calculi", "stone"],
  stone: ["calculi"],
  "gall stone": ["calculi", "gall bladder"],
  piles: ["piles", "haemorrhoids", "hemorrhoids"],
  ulcer: ["ulcer"],
  uterus: ["hysterectomy", "uterus"],
  tonsils: ["tonsillectomy"],
  spine: ["vertebral", "spinal"],
  "slip disc": ["vertebral disc"],
  "varicose": ["varicose"],
  "prostate": ["prostate", "prostatic"],
  "sinus": ["sinusitis", "sinus"],
  "eye": ["cataract", "eye"],
};

export interface ConditionMatch {
  condition: string;
  months: number;
}

/** Listed conditions matching the search, using the policy's own list (and a few everyday synonyms). */
export function findConditions(f: PolicyFacts, query: string): ConditionMatch[] {
  const q = normalise(query);
  if (q.length < 3) return [];
  const terms = new Set([q, ...Object.entries(ALIASES).flatMap(([k, v]) => (q.includes(k) ? v : []))]);
  return (f.waitingConditions ?? []).filter((c) => {
    const name = normalise(c.condition);
    return [...terms].some((t) => name.includes(t) || (t.length >= 5 && t.includes(name)));
  });
}

/** A calendar file (.ics) with one all-day event per waiting period ending in the future. */
export function waitingIcs(policyName: string, items: WaitItem[]): string {
  const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const events = items
    .filter((i) => !i.coveredNow)
    .map((i) =>
      [
        "BEGIN:VEVENT",
        `UID:${i.key}-${day(i.endsOn)}@policylens`,
        `DTSTAMP:${day(new Date())}T000000Z`,
        `DTSTART;VALUE=DATE:${day(i.endsOn)}`,
        `SUMMARY:${esc(`${policyName}: ${i.label} now covered`)}`,
        `DESCRIPTION:${esc(`The ${i.length} waiting period ends today, per PolicyLens. Confirm with your insurer before planning treatment.`)}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PolicyLens//Waiting periods//EN", ...events, "END:VCALENDAR"].join("\r\n");
}
