// Live accuracy check on real insurer policy wordings (labels in real-policy-labels.ts).
// Run: npm run eval   (needs GEMINI_API_KEY and the PDFs in eval-policies/; missing files are skipped)
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { analysePolicy } from "@/lib/ai/analyse-policy";
import { answerQuestion, isGrounded } from "@/lib/ai/answer-question";
import { isTrusted } from "@/lib/citations";
import { calculateClaim } from "@/lib/claim-calc";
import { findConditions } from "@/lib/waiting";
import { readPdf } from "@/lib/pdf";
import type { PolicyFacts } from "@/lib/policy-schema";
import { LABELS, type FactKey } from "./real-policy-labels";

const pick = (f: PolicyFacts): Record<FactKey, unknown> => ({
  roomRentKind: f.roomRent.kind,
  roomRentPercent: f.roomRent.percentOfSumInsured,
  proportionateDeduction: f.proportionateDeduction,
  copayPercent: f.copayPercent,
  copayAlways: f.copayAlways,
  pedWaitingMonths: f.pedWaitingMonths,
  specificDiseaseWaitingMonths: f.specificDiseaseWaitingMonths,
  initialWaitingDays: f.initialWaitingDays,
  maternityCovered: f.maternityCovered,
  preHospitalisationDays: f.preHospitalisationDays,
  postHospitalisationDays: f.postHospitalisationDays,
  restoration: f.restoration,
  noClaimBonusPercentPerYear: f.noClaimBonusPercentPerYear,
});

const available = LABELS.filter((l) => existsSync(`eval-policies/${l.file}`));

test.skipIf(available.length === 0)(
  "real policy wordings: facts, citations and grounded answers",
  async () => {
    const totals = { facts: 0, factsRight: 0, cited: 0, verified: 0, questions: 0, questionsRight: 0 };
    const report: unknown[] = [];

    for (const label of available) {
      const pdf = await readPdf(new Uint8Array(readFileSync(`eval-policies/${label.file}`)));
      const t0 = Date.now();
      const r = await analysePolicy(pdf.pages);
      const got = pick(r.facts);
      const wrong = Object.entries(label.facts)
        .filter(([k, ok]) => !ok.includes(got[k as FactKey]))
        .map(([k, ok]) => ({ fact: k, expected: ok, got: got[k as FactKey] }));
      const cited = r.findings.filter((f) => f.check !== "NONE");
      const verified = cited.filter((f) => isTrusted(f.check));
      totals.facts += Object.keys(label.facts).length;
      totals.factsRight += Object.keys(label.facts).length - wrong.length;
      totals.cited += cited.length;
      totals.verified += verified.length;

      // Facts used by the claim calculator and the timeline.
      const toolWrong: { what: string; expected: unknown; got: unknown }[] = [];
      if (label.tools) {
        const f = r.facts;
        const t = label.tools;
        const lowest = (a: number | null | undefined, b: number | null | undefined) =>
          Math.min(...[a ? (500000 * a) / 100 : Infinity, b || Infinity]);
        const checks: [string, unknown, unknown][] = [
          ["icuCapAt5L", t.icuCapAt5L, f.icuCap ? lowest(f.icuCap.percentOfSumInsured, f.icuCap.rupeesPerDay) : null],
          ["cataractPerEyeAt5L", t.cataractPerEyeAt5L, f.cataractLimit ? lowest(f.cataractLimit.percentOfSumInsured, f.cataractLimit.rupeesPerEye) : null],
          ["copayAllClaims", t.copayAllClaims, (f.copayRules ?? []).filter((c) => c.when === "ALL_CLAIMS").reduce((s, c) => s + c.percent, 0)],
          ...Object.entries(t.conditionMonths).map(([q, m]): [string, unknown, unknown] => [`condition "${q}"`, m, findConditions(f, q)[0]?.months ?? null]),
        ];
        for (const [what, expected, got] of checks) if (expected !== got) toolWrong.push({ what, expected, got });
        totals.facts += checks.length;
        totals.factsRight += checks.length - toolWrong.length;
      }
      const allTrusted = () => true;
      const exampleBill = { sumInsured: 500000, age: 40, days: 4, roomRentPerDay: 8000, icuDays: 1, icuRentPerDay: 15000, doctorFees: 40000, otherHospital: 30000, pharmacy: 25000, consumables: 6000, implants: 0, diagnostics: 15000, higherZone: false, nonNetwork: false, cataractEyes: 0 as const };
      const calcPaid = calculateClaim(r.facts, exampleBill, (fld) => r.findings.some((x) => x.field === fld && isTrusted(x.check))).paid;
      const calcPaidIfAllVerified = calculateClaim(r.facts, exampleBill, allTrusted).paid;

      const answers = [];
      for (const q of label.questions) {
        const a = await answerQuestion(pdf.pages, q.ask);
        const mentions = (q.mustMention ?? []).every((alts) => alts.split("|").some((alt) => a.answer.includes(alt)));
        const right = q.answerable ? isGrounded(a) && mentions : !a.answerable;
        totals.questions++;
        if (right) totals.questionsRight++;
        answers.push({ ask: q.ask, right, answerable: a.answerable, answer: a.answer, checks: a.citations.map((c) => c.check) });
      }

      report.push({
        policy: label.name,
        pages: pdf.pageCount,
        seconds: Math.round((Date.now() - t0) / 1000),
        facts: `${Object.keys(label.facts).length - wrong.length}/${Object.keys(label.facts).length}`,
        wrong,
        toolWrong,
        examplePayout: { withVerifiedClauses: calcPaid, ifAllVerified: calcPaidIfAllVerified },
        citations: `${verified.length}/${cited.length} verified`,
        notFound: cited.filter((f) => f.check === "NOT_FOUND").map((f) => ({ field: f.field, quote: f.quote })),
        answers,
      });
    }

    const summary = {
      policies: available.length,
      factAccuracy: `${totals.factsRight}/${totals.facts}`,
      citationsVerified: `${totals.verified}/${totals.cited}`,
      questions: `${totals.questionsRight}/${totals.questions}`,
    };
    console.log(JSON.stringify({ summary, report }, null, 2));
    writeFileSync("tests/evals/last-real-run.json", JSON.stringify({ at: new Date().toISOString(), summary, report }, null, 2));

    expect(totals.factsRight / totals.facts).toBeGreaterThanOrEqual(0.85);
    expect(totals.verified / Math.max(totals.cited, 1)).toBeGreaterThanOrEqual(0.85);
    expect(totals.questionsRight / Math.max(totals.questions, 1)).toBeGreaterThanOrEqual(0.66);
  },
  900_000,
);
