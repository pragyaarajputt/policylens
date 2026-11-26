import { describe, expect, it } from "vitest";
import { calculateClaim, roomCapPerDay, type ClaimInput } from "@/lib/claim-calc";
import { GO_DIGIT } from "../fixtures/facts";

const all = () => true;
const bill = (over: Partial<ClaimInput> = {}): ClaimInput => ({
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
  ...over,
});

describe("roomCapPerDay", () => {
  it("takes the lower of percent and rupee limits", () => {
    expect(roomCapPerDay(GO_DIGIT, 500000)).toBe(5000); // 2% = 10,000, capped at 5,000
    expect(roomCapPerDay(GO_DIGIT, 200000)).toBe(4000); // 2% = 4,000
  });
});

describe("copayText", () => {
  it("doesn't repeat a percentage the note already has", async () => {
    const { copayText } = await import("@/lib/claim-calc");
    expect(copayText({ percent: 5, note: "5% co-pay on all claims" })).toBe("5% co-pay on all claims");
    expect(copayText({ percent: 20, note: "at age 61 and above" })).toBe("20% at age 61 and above");
  });
});

describe("calculateClaim", () => {
  it("applies the room cap, proportionate deduction, consumables and co-pay", () => {
    const r = calculateClaim(GO_DIGIT, bill(), all);
    const by = Object.fromEntries(r.lines.map((l) => [l.key, l.paid]));
    // Room 8,000/day vs 5,000 limit: room paid 5,000 x 4; associated charges cut to 62.5%.
    expect(by.room).toBe(20000);
    expect(by.doctor).toBe(25000);
    expect(by.other).toBe(18750);
    // Medicines and tests aren't cut; consumables aren't payable.
    expect(by.pharmacy).toBe(25000);
    expect(by.diagnostics).toBe(15000);
    expect(by.consumables).toBe(0);
    const admissible = 20000 + 25000 + 18750 + 25000 + 15000; // 103,750
    expect(r.steps).toEqual([expect.objectContaining({ label: "Co-payment 5%", amount: -Math.round(admissible * 0.05) })]);
    expect(r.billed).toBe(32000 + 40000 + 30000 + 25000 + 6000 + 15000);
    expect(r.paid).toBe(admissible - Math.round(admissible * 0.05));
    expect(r.paid + r.youPay).toBe(r.billed);
    expect(r.warnings).toEqual([]);
  });

  it("doesn't cut anything when the room is within the limit", () => {
    const r = calculateClaim(GO_DIGIT, bill({ roomRentPerDay: 5000, consumables: 0 }), all);
    expect(r.lines.every((l) => l.paid === l.billed)).toBe(true);
  });

  it("caps ICU per day", () => {
    const r = calculateClaim(GO_DIGIT, bill({ icuDays: 2, icuRentPerDay: 15000 }), all);
    expect(r.lines.find((l) => l.key === "icu")).toMatchObject({ billed: 30000, paid: 20000, note: "Limit ₹10,000/day" });
  });

  it("applies the cataract sub-limit per eye", () => {
    const r = calculateClaim(
      GO_DIGIT,
      bill({ days: 1, roomRentPerDay: 3000, doctorFees: 50000, otherHospital: 20000, pharmacy: 5000, consumables: 0, diagnostics: 2000, cataractEyes: 1 }),
      all,
    );
    // 25% of 5L = 1.25L, so the ₹40,000 per eye limit applies, then the 5% co-pay.
    expect(r.steps[0]).toMatchObject({ label: "Cataract sub-limit", amount: -(80000 - 40000) });
    expect(r.paid).toBe(38000);
  });

  it("never pays more than the sum insured", () => {
    const r = calculateClaim(GO_DIGIT, bill({ sumInsured: 100000, roomRentPerDay: 2000, doctorFees: 300000, consumables: 0 }), all);
    expect(r.paid).toBe(100000);
    expect(r.steps.at(-1)).toMatchObject({ label: "Sum insured limit" });
  });

  it("applies age and zone co-pays only when they apply", () => {
    const f = {
      ...GO_DIGIT,
      copayRules: [
        { percent: 20, when: "AGE" as const, fromAge: 61, note: "at age 61+" },
        { percent: 10, when: "ZONE" as const, fromAge: null, note: "in a higher-zone city" },
      ],
    };
    const easy = bill({ roomRentPerDay: 5000, consumables: 0 });
    expect(calculateClaim(f, easy, all).steps).toEqual([]);
    expect(calculateClaim(f, { ...easy, age: 65 }, all).steps[0].label).toBe("Co-payment 20%");
    expect(calculateClaim(f, { ...easy, age: 65, higherZone: true }, all).steps[0].label).toBe("Co-payment 30%");
  });

  it("skips and flags rules whose clause wasn't verified, instead of guessing", () => {
    const r = calculateClaim(GO_DIGIT, bill(), (field) => field !== "room_rent" && field !== "copay");
    expect(r.lines.find((l) => l.key === "room")?.paid).toBe(32000);
    expect(r.lines.find((l) => l.key === "doctor")?.paid).toBe(40000);
    expect(r.steps).toEqual([]);
    expect(r.warnings.map((w) => w.field)).toEqual(["room_rent", "copay"]);
  });

  it("handles a room-category limit and older analyses without the new facts", () => {
    const old: Record<string, unknown> = {
      ...GO_DIGIT,
      roomRent: { kind: "ROOM_CATEGORY", percentOfSumInsured: null, rupeesPerDay: null, roomCategory: "single private AC room" },
    };
    delete old.copayRules;
    delete old.icuCap;
    const r = calculateClaim(old as never, bill({ icuDays: 1, icuRentPerDay: 12000 }), all);
    expect(r.warnings[0].text).toMatch(/category/);
    expect(r.steps[0].label).toBe("Co-payment 5%"); // falls back to copayPercent + copayAlways
  });
});
