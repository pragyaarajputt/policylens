// What the AI must return for a policy: one cited finding per field, plus typed numbers for rules and comparison.
import { z } from "zod";
import { FIELDS } from "@/lib/fields";

const finding = z.object({
  status: z
    .enum(["COVERED", "LIMITED", "NOT_COVERED", "NOT_MENTIONED"])
    .describe("COVERED fully; LIMITED = covered with a cap/condition; NOT_COVERED = excluded; NOT_MENTIONED = the document doesn't say."),
  summary: z.string().max(220).describe("One plain-English sentence for a family, with the key number. Empty if not mentioned."),
  quote: z
    .string()
    .max(1200)
    .nullable()
    .describe("Copy the exact words from the document that support this, word for word, 8 to 40 words. Null if not mentioned."),
  page: z.number().int().min(1).nullable().describe("Page number (from the [[page N]] markers) where the quote appears."),
});

export type FindingOutput = z.infer<typeof finding>;

const facts = z.object({
  insurer: z.string().max(80).nullable(),
  planName: z.string().max(120).nullable(),
  roomRent: z.object({
    kind: z.enum(["NO_LIMIT", "PERCENT_OF_SI", "FIXED_PER_DAY", "ROOM_CATEGORY", "UNCLEAR"]),
    percentOfSumInsured: z.number().min(0).max(100).nullable(),
    rupeesPerDay: z.number().min(0).nullable(),
    roomCategory: z.string().max(80).nullable().describe("e.g. 'single private AC room'"),
  }),
  proportionateDeduction: z.boolean().nullable(),
  copayPercent: z.number().min(0).max(100).nullable().describe("Largest co-pay percentage that can apply"),
  copayAlways: z.boolean().nullable().describe("True if the co-pay applies to every claim regardless of age or zone"),
  deductibleRupees: z.number().min(0).nullable(),
  initialWaitingDays: z.number().int().min(0).nullable(),
  pedWaitingMonths: z.number().int().min(0).nullable(),
  specificDiseaseWaitingMonths: z.number().int().min(0).nullable(),
  maternityCovered: z.boolean().nullable(),
  preHospitalisationDays: z.number().int().min(0).nullable(),
  postHospitalisationDays: z.number().int().min(0).nullable(),
  consumablesCovered: z.boolean().nullable(),
  restoration: z.boolean().nullable(),
  noClaimBonusPercentPerYear: z.number().min(0).max(200).nullable(),
  // Used by the claim calculator and the waiting-period timeline. Kept free of length/number bounds: Gemini rejects
  // schemas with too many states. Limits are enforced after parsing (tidyToolFacts).
  icuCap: z
    .object({ percentOfSumInsured: z.number().nullable(), rupeesPerDay: z.number().nullable() })
    .nullable()
    .describe("Per-day ICU limit; both parts if it says e.g. '5% of SI up to Rs 10,000'. Null if no limit."),
  copayRules: z
    .array(
      z.object({
        percent: z.number(),
        when: z.enum(["ALL_CLAIMS", "AGE", "ZONE", "NON_NETWORK", "OTHER"]),
        fromAge: z.number().nullable().describe("For AGE: the age from which it applies"),
        note: z.string().describe("When it applies, in a few plain words"),
      }),
    )
    .describe("Every co-payment in the document, one entry each. Empty if none."),
  cataractLimit: z
    .object({ percentOfSumInsured: z.number().nullable(), rupeesPerEye: z.number().nullable() })
    .nullable()
    .describe("Cataract sub-limit per eye; both parts if it says 'whichever is lower'. Null if none."),
  maternityWaitingMonths: z.number().nullable(),
  waitingConditions: z
    .array(z.object({ condition: z.string(), months: z.number() }))
    .describe("Each condition/procedure in the specific waiting period list(s), with its months, as written."),
});

export type PolicyFacts = z.infer<typeof facts>;

export const policyExtractionSchema = z.object({
  facts,
  findings: z.object(Object.fromEntries(FIELDS.map((f) => [f.key, finding.describe(f.ask)])) as Record<string, typeof finding>),
});

export type PolicyExtraction = z.infer<typeof policyExtractionSchema>;

export const policyJsonSchema = z.toJSONSchema(policyExtractionSchema, { target: "draft-7" });

const pct = (n: number | null) => (n === null || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, n)));
const amount = (n: number | null) => (n === null || !Number.isFinite(n) || n <= 0 ? null : n);
const whole = (n: number | null, max: number) => (n === null || !Number.isFinite(n) || n < 0 ? null : Math.min(max, Math.round(n)));

/** Enforce sane ranges and sizes on the calculator/timeline facts (the schema sent to Gemini can't carry them). */
export function tidyToolFacts(f: PolicyFacts): PolicyFacts {
  return {
    ...f,
    icuCap: f.icuCap ? { percentOfSumInsured: pct(f.icuCap.percentOfSumInsured), rupeesPerDay: amount(f.icuCap.rupeesPerDay) } : null,
    copayRules: (f.copayRules ?? [])
      .filter((c) => Number.isFinite(c.percent) && c.percent > 0)
      .slice(0, 6)
      .map((c) => ({ ...c, percent: pct(c.percent) ?? 0, fromAge: whole(c.fromAge, 120), note: c.note.slice(0, 140) })),
    cataractLimit: f.cataractLimit
      ? { percentOfSumInsured: pct(f.cataractLimit.percentOfSumInsured), rupeesPerEye: amount(f.cataractLimit.rupeesPerEye) }
      : null,
    maternityWaitingMonths: whole(f.maternityWaitingMonths, 120),
    waitingConditions: (f.waitingConditions ?? [])
      .filter((c) => c.condition.trim() && Number.isFinite(c.months) && c.months >= 0)
      .slice(0, 80)
      .map((c) => ({ condition: c.condition.trim().slice(0, 90), months: Math.min(120, Math.round(c.months)) })),
  };
}
