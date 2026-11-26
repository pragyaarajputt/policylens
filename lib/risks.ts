// "Claim surprise" warnings. Plain rules over the extracted facts (testable, predictable), each tied to
// the finding whose clause backs it. A rule only fires if that finding's citation was verified.
import type { PolicyFacts } from "@/lib/policy-schema";

export type RiskLevel = "high" | "medium" | "low";

export interface Risk {
  code: string;
  level: RiskLevel;
  title: string;
  explain: string;
  /** Finding that backs this risk; its citation must be trusted for the risk to show. */
  field: string;
}

const RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** Typical private-room cost in an Indian metro, used only to illustrate the room-rent cap. */
export const ILLUSTRATIVE_ROOM_RUPEES = 8000;

export function risks(f: PolicyFacts, sumInsuredRupees: number | null, trusted: (field: string) => boolean): Risk[] {
  const out: Risk[] = [];
  const add = (r: Risk) => {
    if (trusted(r.field)) out.push(r);
  };

  const rr = f.roomRent;
  let capPerDay: number | null = null;
  if (rr.kind === "FIXED_PER_DAY" && rr.rupeesPerDay) capPerDay = rr.rupeesPerDay;
  if (rr.kind === "PERCENT_OF_SI" && rr.percentOfSumInsured && sumInsuredRupees) {
    capPerDay = Math.round((sumInsuredRupees * rr.percentOfSumInsured) / 100);
  }
  if (rr.kind === "PERCENT_OF_SI" || rr.kind === "FIXED_PER_DAY") {
    const limit = rr.kind === "PERCENT_OF_SI" ? `${rr.percentOfSumInsured}% of your sum insured` : `₹${rr.rupeesPerDay?.toLocaleString("en-IN")}`;
    let example = "";
    if (capPerDay && capPerDay < ILLUSTRATIVE_ROOM_RUPEES && f.proportionateDeduction) {
      const paidShare = Math.round((capPerDay / ILLUSTRATIVE_ROOM_RUPEES) * 100);
      example = ` For example, in a ₹${ILLUSTRATIVE_ROOM_RUPEES.toLocaleString("en-IN")}/day room, only about ${paidShare}% of most of the bill would be paid.`;
    }
    add({
      code: "ROOM_RENT_CAP",
      level: f.proportionateDeduction ? "high" : "medium",
      title: "Room rent is capped",
      explain: `Room rent is limited to ${limit} per day.${
        f.proportionateDeduction ? " Choose a costlier room and the policy cuts doctor, test and surgery charges in the same proportion." : ""
      }${example}`,
      field: "room_rent",
    });
  } else if (rr.kind === "ROOM_CATEGORY" && rr.roomCategory) {
    add({
      code: "ROOM_CATEGORY",
      level: f.proportionateDeduction ? "medium" : "low",
      title: "Only one room type is fully covered",
      explain: `Covered room: ${rr.roomCategory}. A higher room category can reduce what's paid on the whole bill.`,
      field: "room_rent",
    });
  }

  if (f.copayPercent && f.copayPercent > 0) {
    add({
      code: "COPAY",
      level: f.copayAlways || f.copayPercent >= 20 ? "high" : "medium",
      title: `You pay ${f.copayPercent}% of claims`,
      explain: f.copayAlways
        ? `Every claim: you pay ${f.copayPercent}% yourself.`
        : `Up to ${f.copayPercent}% of a claim is paid by you in some cases (often by age or city). Check the clause.`,
      field: "copay",
    });
  }

  if (f.deductibleRupees && f.deductibleRupees > 0) {
    add({
      code: "DEDUCTIBLE",
      level: "medium",
      title: "Deductible before cover starts",
      explain: `You pay the first ₹${f.deductibleRupees.toLocaleString("en-IN")} of claims yourself.`,
      field: "deductible",
    });
  }

  if (f.pedWaitingMonths && f.pedWaitingMonths >= 36) {
    add({
      code: "LONG_PED_WAIT",
      level: f.pedWaitingMonths >= 48 ? "high" : "medium",
      title: `${f.pedWaitingMonths / 12}-year wait for existing illnesses`,
      explain: `Conditions you already have (like diabetes or BP) aren't covered for ${f.pedWaitingMonths} months. Porting can carry over time already served.`,
      field: "ped_waiting",
    });
  }

  if (f.consumablesCovered === false) {
    add({
      code: "NO_CONSUMABLES",
      level: "medium",
      title: "Consumables aren't paid",
      explain: "Gloves, masks, PPE and similar items often add 5–15% to a hospital bill, and you'd pay these yourself.",
      field: "consumables",
    });
  }

  if (f.maternityCovered === false) {
    add({ code: "NO_MATERNITY", level: "low", title: "No maternity cover", explain: "Childbirth expenses aren't covered.", field: "maternity" });
  }

  if (f.restoration === false) {
    add({
      code: "NO_RESTORATION",
      level: "low",
      title: "No restoration of sum insured",
      explain: "Once the sum insured is used up in a year, a second hospitalisation (for a family floater, anyone) isn't covered.",
      field: "restoration",
    });
  }

  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}
