// Hand labels for real insurer policy wordings, checked clause by clause against each PDF.
// The PDFs themselves are not in the repo (insurers' copyrighted documents): put them in eval-policies/.
// Each fact lists every value we accept; an ambiguous wording accepts each reasonable reading.

export interface PolicyLabel {
  file: string;
  name: string;
  source: string;
  facts: Partial<Record<FactKey, readonly unknown[]>>;
  questions: { ask: string; answerable: boolean; mustMention?: string[] }[];
}

export type FactKey =
  | "roomRentKind"
  | "roomRentPercent"
  | "proportionateDeduction"
  | "copayPercent"
  | "copayAlways"
  | "pedWaitingMonths"
  | "specificDiseaseWaitingMonths"
  | "initialWaitingDays"
  | "maternityCovered"
  | "preHospitalisationDays"
  | "postHospitalisationDays"
  | "restoration"
  | "noClaimBonusPercentPerYear";

export const LABELS: PolicyLabel[] = [
  {
    file: "godigit-arogya-sanjeevani.pdf",
    name: "Go Digit Arogya Sanjeevani (GODHLIP24179V022324)",
    source: "https://www.godigit.com/content/dam/godigit/directportal/en/downloads/health/policy-wordings-arogya-sanjeevani-policy-go-digit.pdf",
    facts: {
      roomRentKind: ["PERCENT_OF_SI"], // 2% of SI, max Rs.5000/day (p.6)
      roomRentPercent: [2],
      proportionateDeduction: [true], // Note 2 under the room limits (p.6)
      copayPercent: [5], // "Co-payment of 5% applicable to claim amount" (p.18)
      copayAlways: [true],
      pedWaitingMonths: [36], // Excl01 (p.8)
      specificDiseaseWaitingMonths: [24, 36], // "24/36 months" by condition (p.8-9)
      initialWaitingDays: [30], // Excl03 (p.8)
      maternityCovered: [false], // Excl18 (p.10)
      preHospitalisationDays: [30],
      postHospitalisationDays: [60],
      restoration: [false, null], // no restoration benefit in the standard product
      noClaimBonusPercentPerYear: [5], // cumulative bonus 5% a claim-free year (p.7)
    },
    questions: [
      { ask: "Is cataract surgery covered, and up to how much?", answerable: true, mustMention: ["40,000|40000", "25%"] },
      { ask: "What is the ambulance limit per hospitalisation?", answerable: true, mustMention: ["2,000|2000"] },
      { ask: "How much is the premium for a 30 year old?", answerable: false },
    ],
  },
];
