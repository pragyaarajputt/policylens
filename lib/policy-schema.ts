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
});

export type PolicyFacts = z.infer<typeof facts>;

export const policyExtractionSchema = z.object({
  facts,
  findings: z.object(Object.fromEntries(FIELDS.map((f) => [f.key, finding.describe(f.ask)])) as Record<string, typeof finding>),
});

export type PolicyExtraction = z.infer<typeof policyExtractionSchema>;

export const policyJsonSchema = z.toJSONSchema(policyExtractionSchema, { target: "draft-7" });
