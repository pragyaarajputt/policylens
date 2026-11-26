// Dev helper: print a PDF's text with page markers, for hand-labelling eval policies.
// Run: npx tsx scripts/dump-pdf-text.ts <file.pdf> > out.txt
import { readFileSync } from "node:fs";
import { readPdf, withPageMarkers } from "../lib/pdf";

const file = process.argv[2];
if (!file) throw new Error("Usage: tsx scripts/dump-pdf-text.ts <file.pdf>");
readPdf(new Uint8Array(readFileSync(file))).then((p) => {
  console.error(`${p.pageCount} pages, scanned=${p.scanned}`);
  console.log(withPageMarkers(p.pages));
});
