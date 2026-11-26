import { describe, expect, it } from "vitest";
import { addMonths, findConditions, waitingIcs, waitingTimeline } from "@/lib/waiting";
import { GO_DIGIT } from "../fixtures/facts";

const all = () => true;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ymd = (x: Date) => x.toISOString().slice(0, 10);

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(ymd(addMonths(d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(ymd(addMonths(d("2026-04-15"), 36))).toBe("2029-04-15");
  });
});

describe("waitingTimeline", () => {
  it("gives the date each wait ends, soonest first", () => {
    const t = waitingTimeline(GO_DIGIT, d("2026-04-15"), 0, d("2026-11-26"), all);
    expect(t.map((i) => [i.key, ymd(i.endsOn), i.coveredNow])).toEqual([
      ["initial", "2026-05-15", true],
      ["specific-24", "2028-04-15", false],
      ["specific-36", "2029-04-15", false],
      ["ped", "2029-04-15", false],
    ]);
    // One row per list, with examples, so hernia isn't read as a 36-month wait.
    expect(t.find((i) => i.key === "specific-24")?.note).toBe("Hernia of all types, Cataract and age-related eye ailments, Calculi in urinary system, Gall Bladder and Bile duct");
    expect(t.find((i) => i.key === "specific-36")?.label).toBe("Listed illnesses and surgeries (36-month list)");
  });

  it("credits earlier continuous cover when porting", () => {
    const t = waitingTimeline(GO_DIGIT, d("2026-04-15"), 24, d("2026-11-26"), all);
    const by = Object.fromEntries(t.map((i) => [i.key, i]));
    expect(ymd(by.initial.endsOn)).toBe("2026-04-15"); // waived after more than 12 months
    expect(by["specific-24"].coveredNow).toBe(true); // 24 - 24 = 0
    expect(by["specific-24"].note).toMatch(/24 months credited from earlier cover$/);
    expect(ymd(by.ped.endsOn)).toBe("2027-04-15"); // 36 - 24 = 12 months
  });

  it("leaves out waits whose clause isn't verified, and maternity when it isn't covered", () => {
    const t = waitingTimeline(GO_DIGIT, d("2026-04-15"), 0, d("2026-11-26"), (f) => f !== "ped_waiting");
    expect(t.map((i) => i.key)).toEqual(["initial", "specific-24", "specific-36"]);
  });
});

describe("findConditions", () => {
  it("finds the policy's listed condition, including everyday words", () => {
    expect(findConditions(GO_DIGIT, "hernia")).toEqual([{ condition: "Hernia of all types", months: 24 }]);
    expect(findConditions(GO_DIGIT, "Kidney stone")[0].condition).toMatch(/Calculi/);
    expect(findConditions(GO_DIGIT, "knee replacement")[0].months).toBe(36);
    expect(findConditions(GO_DIGIT, "dengue")).toEqual([]);
    expect(findConditions(GO_DIGIT, "a")).toEqual([]);
  });
});

describe("waitingIcs", () => {
  it("makes one all-day event per future end date", () => {
    const t = waitingTimeline(GO_DIGIT, d("2026-04-15"), 0, d("2026-11-26"), all);
    const ics = waitingIcs("Arogya Sanjeevani, Go Digit", t);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("DTSTART;VALUE=DATE:20280415");
    expect(ics).toContain("SUMMARY:Arogya Sanjeevani\\, Go Digit: Listed illnesses and surgeries (24-month list) now covered");
  });
});
