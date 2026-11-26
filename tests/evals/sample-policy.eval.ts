// Live check against Gemini on the fictional sample policy, whose correct answers we know.
// Run: npm run eval   (needs GEMINI_API_KEY)
import "dotenv/config";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { analysePolicy } from "@/lib/ai/analyse-policy";
import { readPdf } from "@/lib/pdf";

// What the sample wording says (see scripts/make-sample-policy.ts).
const EXPECTED = {
  roomRentKind: "PERCENT_OF_SI",
  roomRentPercent: 1,
  proportionateDeduction: true,
  // 20% at age 61+ (E.3) plus an additional 10% zone co-pay (E.4): the largest that can apply is 30%.
  copayPercent: 30,
  pedWaitingMonths: 36,
  specificDiseaseWaitingMonths: 24,
  initialWaitingDays: 30,
  maternityCovered: false,
  preHospitalisationDays: 30,
  postHospitalisationDays: 60,
  consumablesCovered: false,
  restoration: true,
  noClaimBonusPercentPerYear: 10,
};

test("analyses the sample policy with verified citations", async () => {
  const pdf = await readPdf(new Uint8Array(readFileSync("samples/example-secure-policy-wording.pdf")));
  const t0 = Date.now();
  const r = await analysePolicy(pdf.pages);
  const f = r.facts;
  const got = {
    roomRentKind: f.roomRent.kind,
    roomRentPercent: f.roomRent.percentOfSumInsured,
    proportionateDeduction: f.proportionateDeduction,
    copayPercent: f.copayPercent,
    pedWaitingMonths: f.pedWaitingMonths,
    specificDiseaseWaitingMonths: f.specificDiseaseWaitingMonths,
    initialWaitingDays: f.initialWaitingDays,
    maternityCovered: f.maternityCovered,
    preHospitalisationDays: f.preHospitalisationDays,
    postHospitalisationDays: f.postHospitalisationDays,
    consumablesCovered: f.consumablesCovered,
    restoration: f.restoration,
    noClaimBonusPercentPerYear: f.noClaimBonusPercentPerYear,
  };
  const wrong = Object.entries(EXPECTED)
    .filter(([k, v]) => got[k as keyof typeof got] !== v)
    .map(([k, v]) => ({ field: k, expected: v, got: got[k as keyof typeof got] }));
  const checks = r.findings.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.check]: (acc[x.check] ?? 0) + 1 }), {});
  const cited = r.findings.filter((x) => x.check !== "NONE").length;
  const verified = r.findings.filter((x) => ["EXACT", "FUZZY", "MOVED"].includes(x.check)).length;

  console.log(JSON.stringify({ model: r.model, attempts: r.attempts, seconds: Math.round((Date.now() - t0) / 1000), facts: `${13 - wrong.length}/13 correct`, wrong, checks, verified: `${verified}/${cited}` }, null, 2));
  console.log("summaries:", r.findings.filter((x) => x.status !== "NOT_MENTIONED").slice(0, 4).map((x) => `${x.field}: ${x.summary}`));
  for (const x of r.findings.filter((x) => x.check === "NOT_FOUND")) console.log(`NOT_FOUND ${x.field}: "${x.quote}"`);

  expect(wrong).toEqual([]);
  expect(verified / Math.max(cited, 1)).toBeGreaterThanOrEqual(0.9);
}, 300_000);
