import { describe, expect, it } from "vitest";
import { findQuote } from "@/lib/highlight";

const PAGE = `SECTION B: IN-PATIENT HOSPITALISATION
B.2 Room Rent: Room, boarding and nursing
expenses are payable up to 1% of the Sum Insured per day for a normal room.
C.1 We will pay road ambulance up to Rs. 2,000 per hospitali-
sation.`;

const cut = (r: ReturnType<typeof findQuote>) => (r ? PAGE.slice(r.start, r.end) : null);

describe("findQuote", () => {
  it("finds an exact quote across a line break", () => {
    const r = findQuote(PAGE, "Room, boarding and nursing expenses are payable up to 1% of the Sum Insured");
    expect(r?.exact).toBe(true);
    expect(cut(r)).toBe("Room, boarding and nursing\nexpenses are payable up to 1% of the Sum Insured");
  });

  it("matches ₹ against Rs.", () => {
    const r = findQuote(PAGE, "road ambulance up to ₹2,000 per");
    expect(r?.exact).toBe(true);
    expect(cut(r)).toBe("road ambulance up to Rs. 2,000 per");
  });

  it("highlights a near-verbatim quote (hyphenated word)", () => {
    const r = findQuote(PAGE, "We will pay road ambulance up to Rs. 2,000 per hospitalisation");
    expect(r?.exact).toBe(false);
    expect(cut(r)?.startsWith("We will pay")).toBe(true);
  });

  it("returns null for a quote that isn't there", () => {
    expect(findQuote(PAGE, "All consumables including gloves and masks are fully payable")).toBeNull();
    expect(findQuote(PAGE, null)).toBeNull();
  });
});

describe("findQuote with a shortened quote", () => {
  it("highlights from the first piece to the last", () => {
    const r = findQuote(PAGE, "Room, boarding and nursing ... 1% of the Sum Insured per day");
    expect(r && PAGE.slice(r.start, r.end)).toBe("Room, boarding and nursing\nexpenses are payable up to 1% of the Sum Insured per day");
  });
});
