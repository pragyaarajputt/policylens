import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { looksLikePdf, PdfError, readPdf, withPageMarkers } from "@/lib/pdf";

async function makePdf(pageTexts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage([595, 842]);
    text.split("\n").forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 16, size: 11, font }));
  }
  return doc.save();
}

describe("readPdf", () => {
  it("returns text per page, in order", async () => {
    const pdf = await makePdf([
      "Section 1 Definitions\nHospital means an institution established for in-patient care",
      "Room Rent: up to 1% of the Sum Insured per day\nfor a normal room and up to 2% for ICU.",
    ]);
    const r = await readPdf(pdf);
    expect(r.pageCount).toBe(2);
    expect(r.scanned).toBe(false);
    expect(r.pages[1]).toContain("1% of the Sum Insured per day");
    expect(r.pages[0]).not.toContain("Room Rent");
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("flags a PDF with almost no text as scanned", async () => {
    const r = await readPdf(await makePdf(["", "", "Page"]));
    expect(r.scanned).toBe(true);
  });

  it("rejects files that aren't PDFs", async () => {
    await expect(readPdf(new TextEncoder().encode("hello, not a pdf"))).rejects.toBeInstanceOf(PdfError);
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
  });

  it("rejects a damaged PDF with a friendly message", async () => {
    await expect(readPdf(new TextEncoder().encode("%PDF-1.7 broken"))).rejects.toThrow(/couldn't be read/);
  });

  it("labels pages for the AI to cite", () => {
    expect(withPageMarkers(["a", "b"])).toBe("[[page 1]]\na\n\n[[page 2]]\nb");
  });
});
