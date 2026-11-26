import { describe, expect, it } from "vitest";
import { policyJsonSchema } from "@/lib/policy-schema";
import type { PolicyFacts } from "@/lib/policy-schema";
import { risks } from "@/lib/risks";
import { FIELDS } from "@/lib/fields";

const base: PolicyFacts = {
  insurer: "Example Health",
  planName: "Example Secure",
  roomRent: { kind: "NO_LIMIT", percentOfSumInsured: null, rupeesPerDay: null, roomCategory: null },
  proportionateDeduction: null,
  copayPercent: null,
  copayAlways: null,
  deductibleRupees: null,
  initialWaitingDays: 30,
  pedWaitingMonths: 24,
  specificDiseaseWaitingMonths: 24,
  maternityCovered: true,
  preHospitalisationDays: 60,
  postHospitalisationDays: 180,
  consumablesCovered: true,
  restoration: true,
  noClaimBonusPercentPerYear: 50,
  icuCap: null,
  copayRules: [],
  cataractLimit: null,
  maternityWaitingMonths: 24,
  waitingConditions: [],
};
const all = (field: string) => field.length >= 0;
const codes = (f: Partial<PolicyFacts>, si: number | null = 500000, trusted = all) => risks({ ...base, ...f }, si, trusted).map((r) => r.code);

describe("risks", () => {
  it("finds nothing in a generous policy", () => {
    expect(codes({})).toEqual([]);
  });

  it("explains a percentage room-rent cap with proportionate deduction, with an example", () => {
    const r = risks({ ...base, roomRent: { ...base.roomRent, kind: "PERCENT_OF_SI", percentOfSumInsured: 1 }, proportionateDeduction: true }, 500000, all);
    expect(r[0]).toMatchObject({ code: "ROOM_RENT_CAP", level: "high" });
    // 1% of ₹5L = ₹5,000/day vs an ₹8,000 room -> about 63% paid.
    expect(r[0].explain).toContain("about 63%");
  });

  it("rates a cap without proportionate deduction as medium", () => {
    const r = risks({ ...base, roomRent: { ...base.roomRent, kind: "FIXED_PER_DAY", rupeesPerDay: 4000 }, proportionateDeduction: false }, null, all);
    expect(r[0]).toMatchObject({ code: "ROOM_RENT_CAP", level: "medium" });
  });

  it.each([
    [{ copayPercent: 20, copayAlways: true }, "COPAY"],
    [{ deductibleRupees: 100000 }, "DEDUCTIBLE"],
    [{ pedWaitingMonths: 48 }, "LONG_PED_WAIT"],
    [{ consumablesCovered: false }, "NO_CONSUMABLES"],
    [{ maternityCovered: false }, "NO_MATERNITY"],
    [{ restoration: false }, "NO_RESTORATION"],
  ] as const)("%j raises %s", (f, code) => {
    expect(codes(f as Partial<PolicyFacts>)).toContain(code);
  });

  it("never warns from a finding whose clause wasn't verified", () => {
    const onlyCopayTrusted = (field: string) => field === "copay";
    expect(codes({ copayPercent: 20, consumablesCovered: false }, 500000, onlyCopayTrusted)).toEqual(["COPAY"]);
  });

  it("orders high before medium before low", () => {
    const r = risks({ ...base, copayPercent: 20, copayAlways: true, maternityCovered: false, deductibleRupees: 25000 }, 500000, all);
    expect(r.map((x) => x.level)).toEqual(["high", "medium", "low"]);
  });
});

describe("extraction schema", () => {
  it("asks for every field, each requiring status, summary, quote and page", () => {
    const s = policyJsonSchema as unknown as { properties: { findings: { properties: Record<string, { required: string[] }>; required: string[] } } };
    expect(s.properties.findings.required.sort()).toEqual(FIELDS.map((f) => f.key).sort());
    expect(s.properties.findings.properties.room_rent.required.sort()).toEqual(["page", "quote", "status", "summary"]);
  });
  it("has 20 unique fields", () => {
    expect(new Set(FIELDS.map((f) => f.key)).size).toBe(20);
  });
});

describe("tidyToolFacts", () => {
  it("clamps and trims what the AI returns for the calculator and timeline", async () => {
    const { tidyToolFacts } = await import("@/lib/policy-schema");
    const t = tidyToolFacts({
      ...base,
      icuCap: { percentOfSumInsured: 500, rupeesPerDay: -1 },
      copayRules: [
        { percent: 0, when: "ALL_CLAIMS", fromAge: null, note: "none" },
        { percent: 20, when: "AGE", fromAge: 60.6, note: "x".repeat(300) },
      ],
      cataractLimit: null,
      maternityWaitingMonths: -5,
      waitingConditions: [
        { condition: "  Hernia  ", months: 24.2 },
        { condition: " ", months: 24 },
      ],
    });
    expect(t.icuCap).toEqual({ percentOfSumInsured: 100, rupeesPerDay: null });
    expect(t.copayRules).toEqual([{ percent: 20, when: "AGE", fromAge: 61, note: "x".repeat(140) }]);
    expect(t.maternityWaitingMonths).toBeNull();
    expect(t.waitingConditions).toEqual([{ condition: "Hernia", months: 24 }]);
  });
});
