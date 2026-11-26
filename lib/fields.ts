// The coverage questions PolicyLens answers for every policy, grouped the way people think about claims.

export interface FieldDef {
  key: string;
  label: string;
  group: "Hospital stay" | "Waiting periods" | "What's paid" | "Extras";
  /** What the AI should look for. Sent in the prompt. */
  ask: string;
}

export const FIELDS: FieldDef[] = [
  { key: "room_rent", label: "Room rent limit", group: "Hospital stay", ask: "Limit on hospital room rent per day (percent of sum insured, fixed amount, room category, or no limit)." },
  { key: "icu", label: "ICU limit", group: "Hospital stay", ask: "Limit on ICU charges per day." },
  { key: "proportionate_deduction", label: "Proportionate deduction", group: "Hospital stay", ask: "Whether other bill items are cut proportionately if a costlier room than allowed is chosen." },
  { key: "copay", label: "Co-payment", group: "Hospital stay", ask: "Any share of each claim the insured must pay (by age, city/zone, or always)." },
  { key: "deductible", label: "Deductible", group: "Hospital stay", ask: "Any amount the insured pays before the policy pays." },
  { key: "initial_waiting", label: "Initial waiting period", group: "Waiting periods", ask: "Days from start during which illnesses (not accidents) aren't covered." },
  { key: "ped_waiting", label: "Pre-existing diseases", group: "Waiting periods", ask: "Waiting period before pre-existing diseases are covered." },
  { key: "specific_disease_waiting", label: "Specific illnesses", group: "Waiting periods", ask: "Waiting period for listed illnesses/procedures (e.g. cataract, hernia, joint replacement)." },
  { key: "maternity", label: "Maternity", group: "Waiting periods", ask: "Whether childbirth is covered, the limit and the waiting period." },
  { key: "pre_post_hospitalisation", label: "Before & after hospitalisation", group: "What's paid", ask: "Days of medical expenses covered before admission and after discharge." },
  { key: "day_care", label: "Day-care treatments", group: "What's paid", ask: "Whether treatments needing less than 24 hours in hospital are covered." },
  { key: "sub_limits", label: "Disease sub-limits", group: "What's paid", ask: "Caps on specific treatments below the sum insured (e.g. cataract per eye, knee replacement)." },
  { key: "consumables", label: "Consumables", group: "What's paid", ask: "Whether non-medical items (gloves, masks, PPE, other consumables) are paid." },
  { key: "modern_treatments", label: "Modern treatments", group: "What's paid", ask: "Coverage and limits for robotic surgery, immunotherapy, stem cell therapy and similar." },
  { key: "ayush", label: "AYUSH treatment", group: "What's paid", ask: "Coverage for Ayurveda, Yoga, Unani, Siddha, Homeopathy in-patient treatment." },
  { key: "domiciliary", label: "Treatment at home", group: "What's paid", ask: "Coverage for treatment at home when hospitalisation isn't possible." },
  { key: "ambulance", label: "Ambulance", group: "Extras", ask: "Road/air ambulance cover and its limit." },
  { key: "restoration", label: "Sum insured restoration", group: "Extras", ask: "Whether the sum insured is refilled after being used up, and the conditions." },
  { key: "no_claim_bonus", label: "No-claim bonus", group: "Extras", ask: "Increase in sum insured for claim-free years, the rate and the maximum." },
  { key: "health_checkup", label: "Health check-up", group: "Extras", ask: "Free or reimbursed preventive health check-ups and how often." },
];

export const FIELD_KEYS = FIELDS.map((f) => f.key) as [string, ...string[]];
export const fieldByKey = new Map(FIELDS.map((f) => [f.key, f]));
export const GROUPS = ["Hospital stay", "Waiting periods", "What's paid", "Extras"] as const;
