import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PolicyExtraction } from "@/lib/policy-schema";

// The AI is faked; its real accuracy is measured by the eval (npm run eval).
const generateJson = vi.fn();
vi.mock("@/lib/ai/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/gemini")>()),
  generateJson,
}));

const { prisma } = await import("@/lib/db");
const { analyseDocument, askQuestion, deleteAccount, deleteDocument, getClausePage, getComparison, getDocument, getDocumentPdf, listDocuments, NotFoundError, PolicyRuleError, uploadDocument } =
  await import("@/lib/data/documents");
const { FIELDS } = await import("@/lib/fields");

async function makePdf(pageTexts: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage([595, 842]);
    text.split("\n").forEach((line, i) => page.drawText(line, { x: 40, y: 790 - i * 15, size: 10, font }));
  }
  return doc.save();
}

const POLICY = [
  "Example Health Insurance Co. Ltd.\nExample Secure Health Policy - Policy Wording\nSection A: Definitions and general terms apply throughout this policy document.",
  "Room Rent: Up to 1% of the Sum Insured per day for a normal room.\nProportionate deduction shall apply to associated medical expenses where the room exceeds the eligible limit.\nNon-medical items such as gloves and masks are excluded.",
  "Pre-existing diseases are covered after a waiting period of 36 months of continuous coverage.\nA co-payment of 20% applies to every claim made under this policy by the insured person.",
];

function fakeExtraction(): PolicyExtraction {
  const findings = Object.fromEntries(
    FIELDS.map((f) => [f.key, { status: "NOT_MENTIONED" as const, summary: "", quote: null, page: null }]),
  ) as PolicyExtraction["findings"];
  findings.room_rent = { status: "LIMITED", summary: "Room rent up to 1% of sum insured per day.", quote: "Room Rent: Up to 1% of the Sum Insured per day for a normal room", page: 2 };
  findings.ped_waiting = { status: "LIMITED", summary: "Existing illnesses covered after 3 years.", quote: "covered after a waiting period of 36 months of continuous coverage", page: 2 }; // page off by one
  findings.copay = { status: "LIMITED", summary: "You pay 20% of every claim.", quote: "A co-payment of 20% applies to every claim made under this policy", page: 3 };
  findings.consumables = { status: "COVERED", summary: "All consumables are fully covered.", quote: "All consumables including gloves and masks are fully payable", page: 2 }; // invented
  return {
    facts: {
      insurer: "Example Health Insurance Co. Ltd.",
      planName: "Example Secure Health Policy",
      roomRent: { kind: "PERCENT_OF_SI", percentOfSumInsured: 1, rupeesPerDay: null, roomCategory: null },
      proportionateDeduction: true,
      copayPercent: 20,
      copayAlways: true,
      deductibleRupees: null,
      initialWaitingDays: null,
      pedWaitingMonths: 36,
      specificDiseaseWaitingMonths: null,
      maternityCovered: null,
      preHospitalisationDays: null,
      postHospitalisationDays: null,
      consumablesCovered: true,
      restoration: null,
      noClaimBonusPercentPerYear: null,
    },
    findings,
  };
}

async function reset() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}
const user = (email: string) => prisma.user.create({ data: { email } }).then((u) => u.id);

beforeEach(async () => {
  await reset();
  generateJson.mockReset().mockResolvedValue({ data: fakeExtraction(), model: "fake", attempts: 1 });
});
afterAll(() => prisma.$disconnect());

describe("upload", () => {
  it("stores text per page and doesn't store the same file twice", async () => {
    const me = await user("me@example.com");
    const pdf = await makePdf(POLICY);
    const first = await uploadDocument(me, "wording.pdf", pdf);
    const again = await uploadDocument(me, "wording copy.pdf", pdf);
    expect(again).toEqual({ id: first.id, duplicate: true });
    const pages = await prisma.documentPage.findMany({ where: { documentId: first.id }, orderBy: { pageNumber: "asc" } });
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(pages[1].text).toContain("1% of the Sum Insured");
  });

  it("marks scanned PDFs instead of sending them to the AI", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "scan.pdf", await makePdf(["", ""]));
    expect((await getDocument(me, id)).status).toBe("SCANNED");
    await expect(analyseDocument(me, id)).rejects.toBeInstanceOf(PolicyRuleError);
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("sanitises file names", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "../../etc/<policy>.pdf", await makePdf(POLICY));
    expect((await getDocument(me, id)).filename).not.toMatch(/[/<>]/);
  });
});

describe("analysis", () => {
  it("stores findings with checked citations: exact, page-corrected, and invented", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    await analyseDocument(me, id);
    const doc = await getDocument(me, id);
    const by = Object.fromEntries(doc.findings.map((f) => [f.field, f]));

    expect(doc).toMatchObject({ status: "READY", planName: "Example Secure Health Policy" });
    expect(doc.findings).toHaveLength(20);
    expect(by.room_rent).toMatchObject({ check: "EXACT", page: 2 });
    expect(by.ped_waiting).toMatchObject({ check: "EXACT", page: 3 }); // AI said page 2: corrected
    expect(by.copay).toMatchObject({ check: "EXACT", page: 3 });
    expect(by.consumables).toMatchObject({ check: "NOT_FOUND", page: null }); // invented clause caught
    expect(by.maternity).toMatchObject({ status: "NOT_MENTIONED", check: "NONE" });
  });

  it("sends the document with page markers and marks failures clearly", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    generateJson.mockRejectedValueOnce(new Error("AI is busy right now."));
    await expect(analyseDocument(me, id)).rejects.toThrow(/busy/);
    expect((await getDocument(me, id)).status).toBe("FAILED");
    expect(generateJson.mock.calls[0][0].prompt).toContain("[[page 2]]");

    await analyseDocument(me, id); // retry works and replaces findings
    expect((await getDocument(me, id)).status).toBe("READY");
    expect(await prisma.finding.count({ where: { documentId: id } })).toBe(20);
  });
});

describe("privacy", () => {
  it("keeps each person's policies to themselves", async () => {
    const me = await user("me@example.com");
    const other = await user("other@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));

    expect(await listDocuments(other)).toHaveLength(0);
    await expect(getDocument(other, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDocumentPdf(other, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(analyseDocument(other, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteDocument(other, id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listDocuments(me)).toHaveLength(1);
  });

  it("deletes an account with everything in it, and nobody else's", async () => {
    const me = await user("me@example.com");
    const other = await user("other@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    await analyseDocument(me, id);
    await uploadDocument(other, "theirs.pdf", await makePdf(POLICY));
    await deleteAccount(me);
    expect(await prisma.user.count({ where: { id: me } })).toBe(0);
    expect(await prisma.document.count({ where: { userId: me } })).toBe(0);
    expect(await prisma.finding.count()).toBe(0);
    expect(await listDocuments(other)).toHaveLength(1);
  });

  it("deletes a policy with its pages and findings", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    await analyseDocument(me, id);
    await deleteDocument(me, id);
    expect(await prisma.documentPage.count()).toBe(0);
    expect(await prisma.finding.count()).toBe(0);
  });
});

describe("questions", () => {
  async function readyPolicy(email = "me@example.com") {
    const me = await user(email);
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    await analyseDocument(me, id);
    return { me, id };
  }

  it("refuses questions before the policy is analysed", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    await expect(askQuestion(me, id, "Is there a co-payment?")).rejects.toBeInstanceOf(PolicyRuleError);
  });

  it("saves answers with checked citations; an invented quote isn't trusted", async () => {
    const { me, id } = await readyPolicy();
    generateJson.mockResolvedValueOnce({
      data: {
        answerable: true,
        answer: "Yes, you pay 20% of every claim.",
        citations: [
          { quote: "A co-payment of 20% applies to every claim made under this policy", page: 3 },
          { quote: "Co-payment is waived for all members below the age of sixty years", page: 3 },
        ],
      },
      model: "fake",
      attempts: 1,
    });
    const q = await askQuestion(me, id, "  Is there a   co-payment? ");
    expect(q.question).toBe("Is there a co-payment?");
    expect(q.citations).toEqual([
      { quote: "A co-payment of 20% applies to every claim made under this policy", page: 3, check: "EXACT" },
      { quote: "Co-payment is waived for all members below the age of sixty years", page: null, check: "NOT_FOUND" },
    ]);
    expect(generateJson.mock.lastCall?.[0].prompt).toContain("<question>\nIs there a co-payment?\n</question>");
    expect((await getDocument(me, id)).questions).toHaveLength(1);
  });

  it("drops citations when the policy doesn't answer", async () => {
    const { me, id } = await readyPolicy();
    generateJson.mockResolvedValueOnce({
      data: { answerable: false, answer: "The policy doesn't say.", citations: [{ quote: "anything at all here", page: 1 }] },
      model: "fake",
      attempts: 1,
    });
    const q = await askQuestion(me, id, "Is dental covered?");
    expect(q).toMatchObject({ answerable: false, citations: [] });
  });

  it("validates the question and keeps questions private", async () => {
    const { id } = await readyPolicy();
    const other = await user("other@example.com");
    await expect(askQuestion(other, id, "Is there a co-payment?")).rejects.toBeInstanceOf(NotFoundError);
    const me = (await prisma.user.findUniqueOrThrow({ where: { email: "me@example.com" } })).id;
    await expect(askQuestion(me, id, "hi")).rejects.toBeInstanceOf(PolicyRuleError);
    await expect(askQuestion(me, id, "x".repeat(301))).rejects.toBeInstanceOf(PolicyRuleError);
  });
});

describe("clause view and comparison", () => {
  it("returns the page text and the finding's quote for highlighting", async () => {
    const me = await user("me@example.com");
    const { id } = await uploadDocument(me, "wording.pdf", await makePdf(POLICY));
    await analyseDocument(me, id);
    const page = await getClausePage(me, id, 3, { field: "ped_waiting" });
    expect(page.text).toContain("36 months");
    expect(page.quote).toBe("covered after a waiting period of 36 months of continuous coverage");
    // A finding on another page isn't highlighted here.
    expect((await getClausePage(me, id, 1, { field: "ped_waiting" })).quote).toBeNull();
    await expect(getClausePage(me, id, 9, {})).rejects.toBeInstanceOf(NotFoundError);
    const other = await user("other@example.com");
    await expect(getClausePage(other, id, 1, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("compares only the user's analysed policies, in the order asked, at most three", async () => {
    const me = await user("me@example.com");
    const other = await user("other@example.com");
    const ids: string[] = [];
    for (const extra of ["A", "B", "C", "D"]) {
      const { id } = await uploadDocument(me, `${extra}.pdf`, await makePdf([...POLICY, `Plan ${extra} schedule of benefits page.`]));
      await analyseDocument(me, id);
      ids.push(id);
    }
    const { id: notAnalysed } = await uploadDocument(me, "new.pdf", await makePdf([...POLICY, "Another plan entirely here."]));
    const { id: theirs } = await uploadDocument(other, "theirs.pdf", await makePdf(POLICY));

    expect((await getComparison(me, [ids[2], ids[0]])).map((d) => d.id)).toEqual([ids[2], ids[0]]);
    expect(await getComparison(me, ids)).toHaveLength(3);
    expect((await getComparison(me, [ids[0], notAnalysed, theirs])).map((d) => d.id)).toEqual([ids[0]]);
  });
});
