import type { PolicyFacts } from "@/lib/policy-schema";

/** Facts as in the real Go Digit Arogya Sanjeevani wording (see tests/evals/real-policy-labels.ts). */
export const GO_DIGIT: PolicyFacts = {
  insurer: "Go Digit General Insurance Limited",
  planName: "Arogya Sanjeevani Policy, Go Digit",
  roomRent: { kind: "PERCENT_OF_SI", percentOfSumInsured: 2, rupeesPerDay: 5000, roomCategory: null },
  proportionateDeduction: true,
  copayPercent: 5,
  copayAlways: true,
  deductibleRupees: null,
  initialWaitingDays: 30,
  pedWaitingMonths: 36,
  specificDiseaseWaitingMonths: 24,
  maternityCovered: false,
  preHospitalisationDays: 30,
  postHospitalisationDays: 60,
  consumablesCovered: false,
  restoration: false,
  noClaimBonusPercentPerYear: 5,
  icuCap: { percentOfSumInsured: 5, rupeesPerDay: 10000 },
  copayRules: [{ percent: 5, when: "ALL_CLAIMS", fromAge: null, note: "on every claim" }],
  cataractLimit: { percentOfSumInsured: 25, rupeesPerEye: 40000 },
  maternityWaitingMonths: null,
  waitingConditions: [
    { condition: "Hernia of all types", months: 24 },
    { condition: "Cataract and age-related eye ailments", months: 24 },
    { condition: "Calculi in urinary system, Gall Bladder and Bile duct", months: 24 },
    { condition: "Joint replacement due to degenerative condition", months: 36 },
  ],
};
