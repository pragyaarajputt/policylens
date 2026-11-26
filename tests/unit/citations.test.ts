import { describe, expect, it } from "vitest";
import { fuzzyScore, isTrusted, normalise, verifyQuote } from "@/lib/citations";

const pages = [
  "SECTION A. DEFINITIONS\n1.1 Hospital means an institution...",
  "Room Rent: Up to 1% of the Sum Insured per day for normal room. ICU: up to 2% of Sum Insured per day.\nProportionate deduction shall apply to associated medical expenses where the room exceeds the eligible limit.",
  "Pre-existing diseases shall be covered after a waiting period of 36 months of continuous coverage since the inception of the first policy with us. Co-pay of 20% applies to insured persons aged 61 and above.",
  "Expenses related to the treatment of cataract are payable up to Rs. 40,000 per eye per policy year. Non-medical expenses including gloves, masks and other consum-\nables are excluded unless the Protector Rider is opted.",
];

describe("normalise", () => {
  it("evens out case, line breaks, quotes, dashes and rupee notation", () => {
    expect(normalise("Rs. 40,000 per\n  EYE")).toBe("₹40 000 per eye");
    expect(normalise("“Hospital” – means")).toBe("hospital - means".replace(" - ", " "));
    expect(normalise("hospital-\nisation")).toBe("hospitalisation");
    expect(normalise("up to 1.5% of SI.")).toBe("up to 1.5% of si");
  });
});

describe("verifyQuote", () => {
  it("accepts an exact quote on the cited page", () => {
    expect(verifyQuote("Up to 1% of the Sum Insured per day for normal room", 2, pages)).toEqual({ check: "EXACT", page: 2 });
  });

  it("tolerates PDF line breaks, case and hyphenated words", () => {
    const q = "gloves, masks and other consumables are excluded unless the Protector Rider is opted";
    expect(verifyQuote(q, 4, pages)).toEqual({ check: "EXACT", page: 4 });
  });

  it("treats Rs. and ₹ as the same", () => {
    expect(verifyQuote("cataract are payable up to ₹40,000 per eye", 4, pages).check).toBe("EXACT");
  });

  it("corrects an off-by-one page without calling it moved", () => {
    expect(verifyQuote("waiting period of 36 months of continuous coverage", 2, pages)).toEqual({ check: "EXACT", page: 3 });
  });

  it("flags a quote found far from the cited page as moved, with the right page", () => {
    const many = ["a page", "b page", "c page", "d page", "e page", ...pages];
    expect(verifyQuote("waiting period of 36 months of continuous coverage", 1, many)).toEqual({ check: "MOVED", page: 8 });
  });

  it("matches a quote that runs over a page break", () => {
    const split = ["…the insurer will pay for modern treatments including", "robotic surgery and stem cell therapy up to the sum insured."];
    expect(verifyQuote("modern treatments including robotic surgery and stem cell therapy", 1, split)).toEqual({ check: "EXACT", page: 1 });
  });

  it("accepts a near-verbatim paraphrase (one word different) as fuzzy", () => {
    const q = "Co-pay of 20% applies to insured persons aged 61 years and above";
    expect(verifyQuote(q, 3, pages)).toEqual({ check: "FUZZY", page: 3 });
  });

  it("rejects an invented clause", () => {
    expect(verifyQuote("Room rent is fully covered with no capping on any room category", 2, pages)).toEqual({
      check: "NOT_FOUND",
      page: null,
    });
  });

  it("rejects a quote with a changed number, even though most words match", () => {
    // 36 months -> 24 months: same sentence, different meaning. Must not be trusted.
    expect(verifyQuote("covered after a waiting period of 24 months", 3, pages).check).toBe("NOT_FOUND");
  });

  it("rejects quotes too short to prove anything, and handles missing quotes", () => {
    expect(verifyQuote("not covered", 2, pages).check).toBe("NOT_FOUND");
    expect(verifyQuote(null, 2, pages)).toEqual({ check: "NONE", page: null });
  });

  it("survives a cited page outside the document", () => {
    expect(verifyQuote("Up to 1% of the Sum Insured per day", 99, pages)).toEqual({ check: "EXACT", page: 2 });
  });
});

describe("fuzzyScore and isTrusted", () => {
  it("scores in-order overlap", () => {
    expect(fuzzyScore(["a", "b", "c", "d"], ["x", "a", "b", "c", "d", "y"])).toBe(1);
    expect(fuzzyScore(["a", "b", "c", "d"], ["d", "c", "b", "a"])).toBeLessThan(0.5);
  });
  it("trusts only checked citations", () => {
    expect(isTrusted("EXACT")).toBe(true);
    expect(isTrusted("NOT_FOUND")).toBe(false);
    expect(isTrusted("NONE")).toBe(false);
  });
});

describe("shortened quotes (with ...)", () => {
  const doc = [
    "Front page of the policy wording with the insurer name and other general words.",
    "In case of admission to a room at rates exceeding the aforesaid limits, the reimbursement of all other expenses incurred at the Hospital, with the exception of pharmacy and consumables, shall be effected in the same proportion as the admissible rate per day bears to the actual rate.",
    "Cumulative Bonus will be increased by 5% in respect of each claim free policy year, provided the policy is renewed with the company without a break subject to maximum of 50% of the sum insured.",
  ];

  it("accepts pieces that are verbatim, in order and close together, but only as near-verbatim", () => {
    expect(
      verifyQuote("In case of admission to a room at rates exceeding the aforesaid limits... shall be effected in the same proportion", 2, doc),
    ).toEqual({ check: "FUZZY", page: 2 });
    expect(verifyQuote("Cumulative Bonus will be increased by 5%… subject to maximum of 50% of the sum insured", 3, doc)).toEqual({
      check: "FUZZY",
      page: 3,
    });
  });

  it("rejects pieces out of order, with a changed word, or stitched from far apart", () => {
    expect(verifyQuote("shall be effected in the same proportion ... In case of admission to a room", 2, doc).check).toBe("NOT_FOUND");
    expect(verifyQuote("Cumulative Bonus will be increased by 10% ... maximum of 50% of the sum insured", 3, doc).check).toBe("NOT_FOUND");
    expect(verifyQuote("Front page of the policy wording ... maximum of 50% of the sum insured", 1, doc).check).toBe("NOT_FOUND");
  });

  it("rejects pieces too small to prove anything", () => {
    expect(verifyQuote("In case ... the same proportion", 2, doc).check).toBe("NOT_FOUND");
    expect(verifyQuote("of ... the same proportion as the admissible", 2, doc).check).toBe("NOT_FOUND");
  });
});
