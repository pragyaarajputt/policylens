// Citation checking: is the quote the AI gave really in the policy, and on which page?
// This is PolicyLens's core promise, so it's plain code with no AI, and heavily tested.

export type CitationCheck = "EXACT" | "FUZZY" | "MOVED" | "NOT_FOUND" | "NONE";

export interface CitationResult {
  check: CitationCheck;
  /** Page (1-based) where the quote was actually found, or null. */
  page: number | null;
}

/** Quotes shorter than this many words are too generic to prove anything ("not covered"). */
export const MIN_QUOTE_WORDS = 4;
/** Share of the quote's words that must appear, in order, for a fuzzy match. */
export const FUZZY_THRESHOLD = 0.9;

/**
 * Normalise text the way PDFs scramble it: Unicode forms, curly quotes and dashes, words split by a
 * hyphen at a line break, ligatures, line breaks and repeated spaces, and case.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[­​-‍﻿]/g, "") // soft hyphen, zero-width characters
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2") // "hospital-\nisation" -> "hospitalisation"
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/Rs\.?\s*/gi, "₹")
    .toLowerCase()
    .replace(/[^a-z0-9%₹.]+/g, " ") // keep letters, digits, %, ₹ and decimal points
    .replace(/\s\.|\.\s|\.$/g, " ") // a full stop is punctuation unless it's inside a number
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => (s ? s.split(" ") : []);

/** Longest common subsequence length of two word arrays (both short: a quote and a window). */
function lcs(a: string[], b: string[]): number {
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = up;
    }
  }
  return prev[b.length];
}

/** Best in-order word overlap of the quote with any same-sized window of the text (0..1). */
export function fuzzyScore(quoteWords: string[], textWords: string[]): number {
  const n = quoteWords.length;
  if (n === 0 || textWords.length === 0) return 0;
  const vocab = new Set(quoteWords);
  const slack = Math.ceil(n * 0.2);
  let best = 0;
  for (let start = 0; start < textWords.length; start++) {
    if (!vocab.has(textWords[start])) continue; // windows only start on a word from the quote
    const window = textWords.slice(start, start + n + slack);
    const score = lcs(quoteWords, window) / n;
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

/**
 * Check a quote against the document. Pages are 1-based; `pages[i]` is the text of page i + 1.
 * Order of preference: exact on the cited page, exact on a neighbouring page or across a page break,
 * exact anywhere (page corrected), then fuzzy on the cited page and its neighbours.
 */
export function verifyQuote(quote: string | null | undefined, citedPage: number | null | undefined, pages: string[]): CitationResult {
  if (!quote) return { check: "NONE", page: null };
  if (ELLIPSIS.test(quote)) return verifyElided(quote, citedPage, pages);
  const q = normalise(quote);
  const qWords = words(q);
  if (qWords.length < MIN_QUOTE_WORDS) return { check: "NOT_FOUND", page: null };

  const norm = pages.map(normalise);
  const has = (i: number) => i >= 0 && i < norm.length;
  const cited = citedPage && has(citedPage - 1) ? citedPage - 1 : null;

  if (cited !== null && norm[cited].includes(q)) return { check: "EXACT", page: cited + 1 };

  // Wholly on a neighbouring page: an off-by-one page number, so correct it.
  if (cited !== null) {
    for (const i of [cited + 1, cited - 1]) {
      if (has(i) && norm[i].includes(q)) return { check: "EXACT", page: i + 1 };
    }
  }

  // Quotes that run over a page break.
  if (cited !== null) {
    for (const [a, b] of [[cited, cited + 1], [cited - 1, cited]] as const) {
      if (has(a) && has(b) && `${norm[a]} ${norm[b]}`.includes(q)) return { check: "EXACT", page: a + 1 };
    }
  }

  // Exact somewhere else: the model got the page wrong, so correct it.
  const elsewhere = norm.findIndex((p) => p.includes(q));
  if (elsewhere !== -1) {
    const offByOne = cited !== null && Math.abs(elsewhere - cited) === 1;
    return { check: cited === null || offByOne ? "EXACT" : "MOVED", page: elsewhere + 1 };
  }

  // Fuzzy, near the cited page only (a fuzzy match far away is too weak to trust).
  const candidates = cited === null ? norm.map((_, i) => i) : [cited, cited - 1, cited + 1].filter(has);
  let best = { score: 0, page: -1 };
  for (const i of candidates) {
    const score = fuzzyScore(qWords, words(norm[i]));
    if (score > best.score) best = { score, page: i };
  }
  if (best.score >= FUZZY_THRESHOLD) return { check: "FUZZY", page: best.page + 1 };

  return { check: "NOT_FOUND", page: null };
}

/** "..." or "…" inside a quote: the model left words out. */
const ELLIPSIS = /\.{3,}|…/;
/** Largest gap (normalised characters) allowed between the pieces of a shortened quote. */
export const MAX_ELISION_CHARS = 400;

/** Split a quote at its ellipses into normalised pieces (empty pieces dropped). */
export const elidedPieces = (quote: string) =>
  quote
    .split(/\.{3,}|…/)
    .map(normalise)
    .filter(Boolean);

/**
 * A quote shortened with "...": every piece must appear word for word, in order, close together, on the
 * cited page or a neighbour (or across their page break). It's never EXACT: at best FUZZY (near-verbatim).
 */
function verifyElided(quote: string, citedPage: number | null | undefined, pages: string[]): CitationResult {
  const pieces = elidedPieces(quote);
  const pieceWords = pieces.map((p) => words(p).length);
  const total = pieceWords.reduce((a, b) => a + b, 0);
  // Each piece must carry some meaning, and at least one must be long enough to prove the clause.
  if (pieces.length === 0 || total < MIN_QUOTE_WORDS || Math.max(...pieceWords) < MIN_QUOTE_WORDS || Math.min(...pieceWords) < 2) {
    return { check: "NOT_FOUND", page: null };
  }

  const norm = pages.map(normalise);
  const has = (i: number) => i >= 0 && i < norm.length;
  const cited = citedPage && has(citedPage - 1) ? citedPage - 1 : null;
  const tries = cited === null ? norm.map((_, i) => i) : [cited, cited + 1, cited - 1].filter(has);

  for (const i of tries) {
    // The page, plus the next page so a quote may run over the page break.
    const text = has(i + 1) ? `${norm[i]} ${norm[i + 1]}` : norm[i];
    let from = text.indexOf(pieces[0]);
    while (from !== -1) {
      let at = from + pieces[0].length;
      let ok = true;
      for (const piece of pieces.slice(1)) {
        const next = text.indexOf(piece, at);
        if (next === -1 || next - at > MAX_ELISION_CHARS) {
          ok = false;
          break;
        }
        at = next + piece.length;
      }
      if (ok) return { check: "FUZZY", page: from < norm[i].length ? i + 1 : i + 2 };
      from = text.indexOf(pieces[0], from + 1);
    }
  }
  return { check: "NOT_FOUND", page: null };
}

/** Whether a finding's citation is good enough to present the value as fact. */
export const isTrusted = (check: CitationCheck) => check === "EXACT" || check === "FUZZY" || check === "MOVED";
