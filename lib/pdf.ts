// PDF text, one string per page, using unpdf (pdf.js built for servers, no native dependencies).
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";

// Vercel caps a request at 4.5 MB, so uploads stay under that (most policy wordings are 0.5–3 MB).
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_PAGES = 150;
/** Below this many characters per page on average, the PDF is most likely scanned images. */
export const SCANNED_CHARS_PER_PAGE = 80;

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfError";
  }
}

export interface PdfText {
  pages: string[];
  pageCount: number;
  scanned: boolean;
  sha256: string;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

export async function readPdf(bytes: Uint8Array): Promise<PdfText> {
  if (bytes.length > MAX_PDF_BYTES) throw new PdfError("That PDF is over 4 MB. Upload the policy wording (usually 1–3 MB) rather than a scanned copy.");
  if (!looksLikePdf(bytes)) throw new PdfError("That file isn't a PDF.");

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let pages: string[];
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes)); // pdf.js takes ownership of the buffer
    if (doc.numPages > MAX_PAGES) throw new PdfError(`That PDF has ${doc.numPages} pages. PolicyLens reads up to ${MAX_PAGES}.`);
    const { text } = await extractText(doc, { mergePages: false });
    pages = (text as string[]).map((t) => t.replace(/\u0000/g, "").trim());
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError("That PDF couldn't be read. It may be password-protected or damaged.");
  }

  const chars = pages.reduce((s, p) => s + p.length, 0);
  return { pages, pageCount: pages.length, scanned: chars / Math.max(pages.length, 1) < SCANNED_CHARS_PER_PAGE, sha256 };
}

/** Document text with page markers the AI cites from: "[[page 3]]". */
export function withPageMarkers(pages: string[]): string {
  return pages.map((t, i) => `[[page ${i + 1}]]\n${t}`).join("\n\n");
}
