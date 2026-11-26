// Claim calculator: what a policy would pay on a given hospital bill.
// Plain arithmetic over the extracted facts, so the same bill always gives the same answer. A rule is applied
// only if the clause behind it was verified in the PDF; otherwise it's skipped and flagged, never guessed.
import type { PolicyFacts } from "@/lib/policy-schema";

export interface ClaimInput {
  sumInsured: number;
  age: number;
  days: number;
  roomRentPerDay: number;
  icuDays: number;
  icuRentPerDay: number;
  doctorFees: number;
  /** OT, nursing, procedure and other hospital charges. */
  otherHospital: number;
  pharmacy: number;
  consumables: number;
  implants: number;
  diagnostics: number;
  higherZone: boolean;
  nonNetwork: boolean;
  /** 0 unless the treatment is cataract surgery. */
  cataractEyes: 0 | 1 | 2;
}

export interface BillLine {
  key: string;
  label: string;
  billed: number;
  paid: number;
  note?: string;
  /** Finding whose clause explains the cut. */
  field?: string;
}

export interface Step {
  label: string;
  amount: number; // negative = taken off
  note: string;
  field: string;
}

export interface ClaimResult {
  lines: BillLine[];
  steps: Step[];
  billed: number;
  paid: number;
  youPay: number;
  /** Rules we couldn't apply because their clause isn't verified or the policy isn't clear. */
  warnings: { text: string; field: string }[];
  roomCapPerDay: number | null;
}

/** "5% on every claim": the AI's note sometimes already includes the percentage. */
export const copayText = (r: { percent: number; note: string }) => (/\d\s*%/.test(r.note) ? r.note : `${r.percent}% ${r.note}`);

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Lowest of the limits that are set ("x% of SI up to ₹y"), or null if none. */
function cap(percent: number | null | undefined, fixed: number | null | undefined, sumInsured: number): number | null {
  const parts = [percent ? (sumInsured * percent) / 100 : null, fixed || null].filter((v): v is number => v !== null && v > 0);
  return parts.length ? Math.min(...parts) : null;
}

/** Room-rent limit per day in rupees: null when there's no limit or it can't be put in rupees. */
export function roomCapPerDay(f: PolicyFacts, sumInsured: number): number | null {
  const rr = f.roomRent;
  if (rr.kind === "PERCENT_OF_SI") return cap(rr.percentOfSumInsured, rr.rupeesPerDay, sumInsured);
  if (rr.kind === "FIXED_PER_DAY") return cap(null, rr.rupeesPerDay, sumInsured);
  return null;
}

export function calculateClaim(f: PolicyFacts, input: ClaimInput, trusted: (field: string) => boolean): ClaimResult {
  const i = {
    ...input,
    days: Math.round(clean(input.days)),
    icuDays: Math.round(clean(input.icuDays)),
    sumInsured: clean(input.sumInsured),
  };
  const warnings: ClaimResult["warnings"] = [];
  const skip = (field: string, text: string) => warnings.push({ field, text });

  // Room rent and the proportion everything "associated" is cut by.
  const roomTrusted = trusted("room_rent");
  const roomCap = roomTrusted ? roomCapPerDay(f, i.sumInsured) : null;
  if (!roomTrusted) skip("room_rent", "The room-rent clause wasn't verified, so no room limit is applied.");
  else if (f.roomRent.kind === "ROOM_CATEGORY") {
    skip("room_rent", `Room limit is a category (${f.roomRent.roomCategory ?? "see clause"}), not an amount: assumed your room is within it.`);
  } else if (f.roomRent.kind === "UNCLEAR") skip("room_rent", "The room-rent limit isn't clear in the policy, so it isn't applied.");

  const room = clean(i.roomRentPerDay);
  const roomOver = roomCap !== null && room > roomCap;
  let ratio = 1;
  if (roomOver) {
    if (!trusted("proportionate_deduction")) {
      skip("proportionate_deduction", "The proportionate-deduction clause wasn't verified, so other charges aren't cut.");
    } else if (f.proportionateDeduction) ratio = roomCap / room;
  }

  const icuTrusted = trusted("icu");
  const icuCap = icuTrusted && f.icuCap ? cap(f.icuCap.percentOfSumInsured, f.icuCap.rupeesPerDay, i.sumInsured) : null;
  if (i.icuDays > 0 && !icuTrusted) skip("icu", "The ICU clause wasn't verified, so no ICU limit is applied.");

  const pct = Math.round(ratio * 100);
  const cut = ratio < 1 ? `Cut to ${pct}% because the room costs more than the ${rupees(roomCap ?? 0)}/day limit` : undefined;

  const lines: BillLine[] = [];
  const line = (l: BillLine) => {
    if (l.billed > 0) lines.push({ ...l, billed: Math.round(l.billed), paid: Math.round(l.paid) });
  };

  line({
    key: "room",
    label: `Room rent (${i.days} day${i.days === 1 ? "" : "s"})`,
    billed: room * i.days,
    paid: Math.min(room, roomCap ?? room) * i.days,
    note: roomOver ? `Limit ${rupees(roomCap ?? 0)}/day` : undefined,
    field: "room_rent",
  });
  const icu = clean(i.icuRentPerDay);
  line({
    key: "icu",
    label: `ICU (${i.icuDays} day${i.icuDays === 1 ? "" : "s"})`,
    billed: icu * i.icuDays,
    paid: Math.min(icu, icuCap ?? icu) * i.icuDays,
    note: icuCap !== null && icu > icuCap ? `Limit ${rupees(icuCap)}/day` : undefined,
    field: "icu",
  });
  line({ key: "doctor", label: "Doctor and surgeon fees", billed: clean(i.doctorFees), paid: clean(i.doctorFees) * ratio, note: cut, field: "proportionate_deduction" });
  line({ key: "other", label: "OT, nursing and other hospital charges", billed: clean(i.otherHospital), paid: clean(i.otherHospital) * ratio, note: cut, field: "proportionate_deduction" });
  // Medicines, implants and tests are outside proportionate deduction (IRDAI standard; the clause usually says so).
  line({ key: "pharmacy", label: "Medicines", billed: clean(i.pharmacy), paid: clean(i.pharmacy) });
  line({ key: "implants", label: "Implants and devices", billed: clean(i.implants), paid: clean(i.implants) });
  line({ key: "diagnostics", label: "Tests and scans", billed: clean(i.diagnostics), paid: clean(i.diagnostics) });

  const consumables = clean(i.consumables);
  let consumablesPaid = consumables;
  let consumablesNote: string | undefined;
  if (consumables > 0) {
    if (!trusted("consumables")) skip("consumables", "The consumables clause wasn't verified, so consumables are counted as paid.");
    else if (f.consumablesCovered === false) {
      consumablesPaid = 0;
      consumablesNote = "Not payable under this policy";
    }
  }
  line({ key: "consumables", label: "Consumables (gloves, PPE, kits)", billed: consumables, paid: consumablesPaid, note: consumablesNote, field: "consumables" });

  const billed = lines.reduce((s, l) => s + l.billed, 0);
  let paid = lines.reduce((s, l) => s + l.paid, 0);
  const steps: Step[] = [];
  const take = (amount: number, label: string, note: string, field: string) => {
    const a = Math.min(Math.round(amount), paid);
    if (a <= 0) return;
    paid -= a;
    steps.push({ label, amount: -a, note, field });
  };

  // Cataract sub-limit, per eye.
  if (i.cataractEyes > 0) {
    if (!trusted("sub_limits") || !f.cataractLimit) skip("sub_limits", "No verified cataract limit, so none is applied.");
    else {
      const perEye = cap(f.cataractLimit.percentOfSumInsured, f.cataractLimit.rupeesPerEye, i.sumInsured);
      if (perEye !== null) take(paid - perEye * i.cataractEyes, "Cataract sub-limit", `Up to ${rupees(perEye)} per eye`, "sub_limits");
    }
  }

  // Deductible: you pay this first.
  if (f.deductibleRupees) {
    if (trusted("deductible")) take(f.deductibleRupees, "Deductible", `You pay the first ${rupees(f.deductibleRupees)}`, "deductible");
    else skip("deductible", "The deductible clause wasn't verified, so it isn't applied.");
  }

  // Co-payments that apply to this person and this hospital.
  const rules = f.copayRules ?? [];
  const applicable = rules.filter(
    (r) => r.when === "ALL_CLAIMS" || (r.when === "AGE" && r.fromAge !== null && i.age >= r.fromAge) || (r.when === "ZONE" && i.higherZone) || (r.when === "NON_NETWORK" && i.nonNetwork),
  );
  if (rules.length === 0 && f.copayAlways && f.copayPercent) applicable.push({ percent: f.copayPercent, when: "ALL_CLAIMS", fromAge: null, note: "on every claim" });
  if (applicable.length > 0) {
    if (trusted("copay")) {
      const percent = Math.min(100, applicable.reduce((s, r) => s + r.percent, 0));
      take((paid * percent) / 100, `Co-payment ${percent}%`, applicable.map(copayText).join(" + "), "copay");
    } else skip("copay", "The co-payment clause wasn't verified, so no co-pay is applied.");
  }
  for (const r of rules.filter((r) => r.when === "OTHER")) skip("copay", `Not applied (check if it applies to you): co-pay ${copayText(r)}.`);

  // Never more than the sum insured.
  if (i.sumInsured > 0) take(paid - i.sumInsured, "Sum insured limit", `The most the policy pays is ${rupees(i.sumInsured)}`, "");

  paid = Math.max(0, Math.round(paid));
  return { lines, steps, billed: Math.round(billed), paid, youPay: Math.round(billed) - paid, warnings, roomCapPerDay: roomCap };
}
