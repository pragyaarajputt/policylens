// Generates a realistic but entirely fictional policy wording PDF for demos and end-to-end tests.
// Run: npx tsx scripts/make-sample-policy.ts  ->  samples/example-secure-policy-wording.pdf
import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGES: string[][] = [
  [
    "EXAMPLE HEALTH INSURANCE COMPANY LIMITED",
    "Example Secure Health Policy - Policy Wording",
    "UIN: EXAHLIP00000V012526 (fictional, for demonstration only)",
    "",
    "PREAMBLE",
    "This Policy is a contract of insurance between You and Us which is subject to the receipt of premium in full and the terms, conditions and exclusions of this Policy. The Schedule, Proposal Form and this Policy Wording together form the contract.",
    "",
    "SECTION A: DEFINITIONS",
    "A.1 Hospital means any institution established for in-patient care and day care treatment of illness and/or injuries and which has been registered as a hospital with the local authorities.",
    "A.2 Sum Insured means the amount specified in the Schedule, which is Our maximum liability for any and all claims during the Policy Year in respect of all Insured Persons.",
    "A.3 Pre-existing Disease means any condition, ailment, injury or disease that is diagnosed by a physician within 36 months prior to the date of commencement of the first policy issued by Us.",
  ],
  [
    "SECTION B: IN-PATIENT HOSPITALISATION",
    "B.1 We will pay the Medical Expenses incurred for In-patient Care for a minimum period of 24 consecutive hours.",
    "B.2 Room Rent: Room, boarding and nursing expenses are payable up to 1% of the Sum Insured per day for a normal room.",
    "B.3 Intensive Care Unit charges are payable up to 2% of the Sum Insured per day.",
    "B.4 Proportionate Deduction: If the Insured Person is admitted in a room category with a room rent higher than the eligible limit, all associated Medical Expenses shall be payable in the same proportion as the eligible room rent bears to the actual room rent incurred. This shall not apply to cost of pharmacy, consumables, implants and diagnostics.",
    "B.5 Pre-hospitalisation Medical Expenses are payable for 30 days immediately before the date of admission, and Post-hospitalisation Medical Expenses for 60 days immediately after the date of discharge.",
    "B.6 Day Care Treatment: We will pay for all day care procedures listed in Annexure I which require less than 24 hours of hospitalisation due to technological advancement.",
  ],
  [
    "SECTION C: OTHER BENEFITS",
    "C.1 Emergency Road Ambulance: We will pay expenses for road ambulance services up to Rs. 2,000 per hospitalisation.",
    "C.2 AYUSH Treatment: In-patient treatment under Ayurveda, Yoga and Naturopathy, Unani, Siddha and Homeopathy is covered up to the Sum Insured in a government recognised AYUSH hospital.",
    "C.3 Domiciliary Hospitalisation: Medical treatment taken at home on the advice of a medical practitioner, where the patient could not be moved to a hospital, is covered up to 10% of the Sum Insured.",
    "C.4 Modern Treatments: Robotic surgeries, stem cell therapy, immunotherapy and oral chemotherapy are covered up to 50% of the Sum Insured per Policy Year.",
    "C.5 Restoration of Sum Insured: If the Sum Insured is exhausted during the Policy Year, it will be restored once by 100%, for a subsequent unrelated illness only.",
    "C.6 Cumulative Bonus: For every claim-free Policy Year, the Sum Insured will increase by 10% of the base Sum Insured, up to a maximum of 50%.",
    "C.7 Health Check-up: All adult Insured Persons are eligible for one preventive health check-up every two claim-free Policy Years, up to Rs. 1,500 per person.",
  ],
  [
    "SECTION D: WAITING PERIODS",
    "D.1 Initial Waiting Period: Expenses related to the treatment of any illness within 30 days from the first policy commencement date shall be excluded, except claims arising due to an accident.",
    "D.2 Pre-existing Diseases: Expenses related to the treatment of a pre-existing disease and its direct complications shall be excluded until the expiry of 36 months of continuous coverage after the date of inception of the first policy with Us.",
    "D.3 Specified Disease / Procedure Waiting Period: Expenses related to the treatment of the listed conditions, surgeries and treatments, including cataract, hernia, joint replacement and benign prostatic hypertrophy, shall be excluded until the expiry of 24 months of continuous coverage.",
    "D.4 Maternity: Expenses for childbirth, including caesarean section, and lawful medical termination of pregnancy are excluded under this Policy.",
  ],
  [
    "SECTION E: SUB-LIMITS AND CO-PAYMENT",
    "E.1 Treatment of cataract is payable up to Rs. 40,000 per eye per Policy Year.",
    "E.2 Knee replacement surgery is payable up to Rs. 1,50,000 per knee for the entire Policy Period.",
    "E.3 Co-payment: A co-payment of 20% shall apply on each and every admissible claim for Insured Persons aged 61 years and above at the time of entry.",
    "E.4 Zone-based co-payment: An additional co-payment of 10% shall apply if the Insured Person avails treatment in a city of a higher zone than the zone chosen in the Schedule.",
    "E.5 Deductible: No deductible applies under this Policy.",
  ],
  [
    "SECTION F: EXCLUSIONS",
    "F.1 Non-medical items: Expenses on items such as gloves, masks, PPE kits, nebulizer kits, belts and other consumables listed in Annexure II are excluded.",
    "F.2 Treatment for alcoholism, drug or substance abuse or any addictive condition and consequences thereof.",
    "F.3 Cosmetic or plastic surgery or any treatment to change appearance unless for reconstruction following an accident, burns or cancer.",
    "F.4 Expenses for vitamins, tonics, nutritional supplements unless forming part of treatment for injury or illness as certified by the attending physician.",
  ],
  [
    "SECTION G: GENERAL TERMS AND CLAUSES",
    "G.1 Free Look Period: You have a period of 30 days from the date of receipt of the policy document to review the terms and conditions of this Policy.",
    "G.2 Portability: The Insured Person will have the option to port the Policy to another insurer, and waiting periods already served will be credited as per the guidelines of the Authority.",
    "G.3 Grievances: In case of any grievance, the Insured Person may contact Our grievance cell, and thereafter the Insurance Ombudsman.",
    "",
    "This document is a fictional example created for demonstrating PolicyLens. It does not describe any real insurance product.",
  ],
];

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle("Example Secure Health Policy - Policy Wording (fictional)");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 10;
  const maxWidth = 495;

  const wrap = (text: string, f = font) => {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    return lines;
  };

  PAGES.forEach((paras, i) => {
    const page = doc.addPage([595, 842]);
    let y = 790;
    for (const para of paras) {
      const isHeading = /^[A-Z][A-Z :-]+$/.test(para) && para.length < 80;
      const f = isHeading ? bold : font;
      for (const l of wrap(para, f)) {
        page.drawText(l, { x: 50, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
      }
      y -= 6;
    }
    page.drawText(`Page ${i + 1} of ${PAGES.length}`, { x: 50, y: 30, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  });

  mkdirSync("samples", { recursive: true });
  writeFileSync("samples/example-secure-policy-wording.pdf", await doc.save());
  console.log("samples/example-secure-policy-wording.pdf");
}

void main();
