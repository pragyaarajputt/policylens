// Find where a (checked) quote sits in a page's raw text, so the clause view can highlight it.
// Works on words, using the same normalisation as citation checking, and maps back to character offsets.
import { FUZZY_THRESHOLD, normalise } from "@/lib/citations";

interface Token {
  word: string;
  start: number;
  end: number;
}

/** "₹5" and "₹ 5" should compare equal, so the rupee sign is always its own word. */
const splitWords = (normalised: string) => normalised.replace(/₹/g, " ₹ ").split(" ").filter(Boolean);

function tokenise(raw: string): Token[] {
  const tokens: Token[] = [];
  for (const m of raw.matchAll(/\S+/g)) {
    const start = m.index ?? 0;
    for (const word of splitWords(normalise(m[0]))) tokens.push({ word, start, end: start + m[0].length });
  }
  return tokens;
}

export interface HighlightRange {
  start: number;
  end: number;
  exact: boolean;
}

/** Character range of the quote in `raw`, or null if it isn't there (closely enough). */
export function findQuote(raw: string, quote: string | null | undefined): HighlightRange | null {
  if (!quote) return null;
  // A shortened quote ("A ... B"): highlight from where A starts to where B ends.
  const parts = quote.split(/\.{3,}|…/).filter((p) => normalise(p));
  if (parts.length > 1) {
    const first = findQuote(raw, parts[0]);
    const lastPart = findQuote(first ? raw.slice(first.end) : raw, parts[parts.length - 1]);
    if (first && lastPart) return { start: first.start, end: first.end + lastPart.end, exact: false };
    return first;
  }
  const q = splitWords(normalise(quote));
  const tokens = tokenise(raw);
  if (q.length === 0 || tokens.length < q.length) return null;
  const words = tokens.map((t) => t.word);

  // Exact run of words.
  outer: for (let i = 0; i + q.length <= words.length; i++) {
    for (let j = 0; j < q.length; j++) if (words[i + j] !== q[j]) continue outer;
    return { start: tokens[i].start, end: tokens[i + q.length - 1].end, exact: true };
  }

  // Near-verbatim: the window with the most quote words in order, trimmed to the matched words.
  const slack = Math.ceil(q.length * 0.2);
  let best = { score: 0, first: -1, last: -1 };
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== q[0] && words[i] !== q[1]) continue;
    let qi = 0;
    let hits = 0;
    let first = -1;
    let last = -1;
    for (let k = i; k < Math.min(words.length, i + q.length + slack) && qi < q.length; k++) {
      // Greedy in-order match; good enough to place a highlight on an already-verified quote.
      const at = q.indexOf(words[k], qi);
      if (at !== -1 && at - qi <= 2) {
        if (first === -1) first = k;
        last = k;
        qi = at + 1;
        hits++;
      }
    }
    const score = hits / q.length;
    if (score > best.score) best = { score, first, last };
  }
  if (best.score >= FUZZY_THRESHOLD - 0.05 && best.first !== -1) {
    return { start: tokens[best.first].start, end: tokens[best.last].end, exact: false };
  }
  return null;
}
