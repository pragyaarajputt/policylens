import "server-only";
import { analysePolicy } from "@/lib/ai/analyse-policy";
import { answerQuestion, MAX_QUESTION_CHARS, MIN_QUESTION_CHARS } from "@/lib/ai/answer-question";
import { prisma } from "@/lib/db";
import { readPdf } from "@/lib/pdf";
import { Prisma } from "@/lib/generated/prisma/client";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";

/** A rule broken by the request, with a message safe to show the user. */
export class PolicyRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyRuleError";
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("That policy wasn't found.");
    this.name = "NotFoundError";
  }
}

const safeName = (name: string) => name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "policy.pdf";

/**
 * Store a PDF and its text, one row per page. The same file uploaded twice by one user is stored once.
 * Analysis is a separate step, so the upload itself is quick.
 */
export async function uploadDocument(userId: string, filename: string, bytes: Uint8Array) {
  const limited = await rateLimit("upload", userId, LIMITS.uploadsPerUser.limit, LIMITS.uploadsPerUser.windowMs);
  if (!limited.allowed) throw new PolicyRuleError("That's a lot of uploads in an hour. Try again a little later.");

  const copy = new Uint8Array(bytes); // readPdf hands its buffer to pdf.js
  const pdf = await readPdf(bytes);

  const existing = await prisma.document.findUnique({
    where: { userId_sha256: { userId, sha256: pdf.sha256 } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, duplicate: true };

  try {
    const doc = await prisma.document.create({
      data: {
        userId,
        filename: safeName(filename),
        sizeBytes: copy.length,
        sha256: pdf.sha256,
        pageCount: pdf.pageCount,
        pdf: copy,
        status: pdf.scanned ? "SCANNED" : "UPLOADED",
        error: pdf.scanned ? "This looks like a scanned PDF (images, no text). PolicyLens needs a text PDF of the policy wording." : null,
        pages: { create: pdf.pages.map((text, i) => ({ pageNumber: i + 1, text })) },
      },
      select: { id: true },
    });
    return { id: doc.id, duplicate: false };
  } catch (error) {
    // Two uploads of the same file at once: the unique (userId, sha256) index lets only one through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const doc = await prisma.document.findUniqueOrThrow({ where: { userId_sha256: { userId, sha256: pdf.sha256 } } });
      return { id: doc.id, duplicate: true };
    }
    throw error;
  }
}

/** Run the AI analysis and store cited, checked findings. Safe to re-run: findings are replaced. */
export async function analyseDocument(userId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { pages: { orderBy: { pageNumber: "asc" }, select: { text: true } } },
  });
  if (!doc) throw new NotFoundError();
  if (doc.status === "SCANNED") throw new PolicyRuleError(doc.error ?? "This PDF has no text to read.");
  if (doc.status === "ANALYSING" && doc.updatedAt > new Date(Date.now() - 3 * 60_000)) {
    throw new PolicyRuleError("This policy is already being analysed.");
  }

  const limited = await rateLimit("analyse", userId, LIMITS.analysesPerUser.limit, LIMITS.analysesPerUser.windowMs);
  if (!limited.allowed) throw new PolicyRuleError("You've analysed a lot of policies this hour. Try again later.");

  await prisma.document.update({ where: { id: doc.id }, data: { status: "ANALYSING", error: null } });
  try {
    const analysis = await analysePolicy(doc.pages.map((p) => p.text));
    await prisma.$transaction([
      prisma.finding.deleteMany({ where: { documentId: doc.id } }),
      prisma.finding.createMany({ data: analysis.findings.map((f) => ({ ...f, documentId: doc.id })) }),
      prisma.document.update({
        where: { id: doc.id },
        data: {
          status: "READY",
          insurer: analysis.facts.insurer,
          planName: analysis.facts.planName,
          facts: analysis.facts as unknown as Prisma.InputJsonValue,
          model: analysis.model,
          analysedAt: new Date(),
        },
      }),
    ]);
    return analysis;
  } catch (error) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 300) : "Analysis failed." },
    });
    throw error;
  }
}

export async function listDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    select: { id: true, filename: true, insurer: true, planName: true, status: true, pageCount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocument(userId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      filename: true,
      insurer: true,
      planName: true,
      status: true,
      error: true,
      pageCount: true,
      facts: true,
      model: true,
      analysedAt: true,
      createdAt: true,
      findings: true,
      questions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!doc) throw new NotFoundError();
  return doc;
}

export async function getDocumentPdf(userId: string, documentId: string) {
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId }, select: { pdf: true, filename: true } });
  if (!doc) throw new NotFoundError();
  return doc;
}

export async function deleteDocument(userId: string, documentId: string) {
  const { count } = await prisma.document.deleteMany({ where: { id: documentId, userId } });
  if (count === 0) throw new NotFoundError();
}

/** Ask a question about one analysed policy. The answer and its checked citations are saved. */
export async function askQuestion(userId: string, documentId: string, rawQuestion: string) {
  const question = rawQuestion.replace(/\s+/g, " ").trim();
  if (question.length < MIN_QUESTION_CHARS) throw new PolicyRuleError("Type a question about your policy.");
  if (question.length > MAX_QUESTION_CHARS) throw new PolicyRuleError(`Keep the question under ${MAX_QUESTION_CHARS} characters.`);

  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true, status: true, pages: { orderBy: { pageNumber: "asc" }, select: { text: true } } },
  });
  if (!doc) throw new NotFoundError();
  if (doc.status !== "READY") throw new PolicyRuleError("Analyse the policy first, then ask questions about it.");

  const limited = await rateLimit("question", userId, LIMITS.questionsPerUser.limit, LIMITS.questionsPerUser.windowMs);
  if (!limited.allowed) throw new PolicyRuleError("That's a lot of questions this hour. Try again a little later.");

  const a = await answerQuestion(doc.pages.map((p) => p.text), question);
  return prisma.question.create({
    data: {
      documentId: doc.id,
      question,
      answer: a.answer,
      answerable: a.answerable,
      citations: a.citations as unknown as Prisma.InputJsonValue,
      model: a.model,
    },
  });
}

/** One page's text, for the clause view, with the quote to highlight (from a finding or a saved answer). */
export async function getClausePage(
  userId: string,
  documentId: string,
  pageNumber: number,
  highlight: { field?: string; questionId?: string; citation?: number },
) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true, filename: true, planName: true, pageCount: true },
  });
  if (!doc) throw new NotFoundError();
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.pageCount) throw new NotFoundError();

  const page = await prisma.documentPage.findUnique({
    where: { documentId_pageNumber: { documentId: doc.id, pageNumber } },
    select: { text: true },
  });

  let quote: string | null = null;
  let label: string | null = null;
  if (highlight.field) {
    const f = await prisma.finding.findUnique({ where: { documentId_field: { documentId: doc.id, field: highlight.field } } });
    if (f?.page === pageNumber) quote = f.quote;
    label = highlight.field;
  } else if (highlight.questionId) {
    const q = await prisma.question.findFirst({ where: { id: highlight.questionId, documentId: doc.id } });
    const c = (q?.citations as { quote: string; page: number | null }[] | undefined)?.[highlight.citation ?? 0];
    if (c?.page === pageNumber) quote = c.quote;
    label = q?.question ?? null;
  }
  return { doc, pageNumber, text: page?.text ?? "", quote, label };
}

/** Up to three of the user's analysed policies, in the order asked, for side-by-side comparison. */
export async function getComparison(userId: string, ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 3);
  const docs = await prisma.document.findMany({
    where: { id: { in: unique }, userId, status: "READY" },
    select: { id: true, filename: true, insurer: true, planName: true, facts: true, findings: true },
  });
  return unique.map((id) => docs.find((d) => d.id === id)).filter((d) => d !== undefined);
}

export async function listReadyDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId, status: "READY" },
    select: { id: true, filename: true, insurer: true, planName: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Delete the account and, by cascade, every policy, page, finding, question and sign-in record. */
export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}
