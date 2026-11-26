import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getClausePage, NotFoundError } from "@/lib/data/documents";
import { FIELDS } from "@/lib/fields";
import { findQuote } from "@/lib/highlight";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Clause" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function ClausePage({ params, searchParams }: PageProps<"/policies/[id]/clause/[page]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the page…</p>}>
      <Clause params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Clause({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; page: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id, page }, sp] = await Promise.all([params, searchParams]);
  const userId = await requireUserId();
  const field = one(sp.f);
  const questionId = one(sp.q);
  const data = await getClausePage(userId, id, Number(page), {
    field: field && FIELDS.some((f) => f.key === field) ? field : undefined,
    questionId,
    citation: Number(one(sp.c) ?? 0) || 0,
  }).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  const range = findQuote(data.text, data.quote);
  const label = field ? (FIELDS.find((f) => f.key === field)?.label ?? null) : data.label;
  const before = range ? data.text.slice(0, range.start) : data.text;
  const marked = range ? data.text.slice(range.start, range.end) : "";
  const after = range ? data.text.slice(range.end) : "";

  return (
    <div className="grid gap-6">
      <Link href={`/policies/${data.doc.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {data.doc.planName ?? data.doc.filename}
      </Link>
      <header className="grid gap-2">
        <p className="eyebrow">
          Page {data.pageNumber} of {data.doc.pageCount}
        </p>
        <h1 className="display text-4xl">{label ?? "Policy text"}</h1>
        {data.quote && (
          <p className="text-sm text-muted-foreground">
            {range ? "The highlighted words are the clause the answer relies on." : "The quoted clause continues from the previous or next page."}
          </p>
        )}
      </header>

      <nav aria-label="Pages" className="flex flex-wrap items-center gap-2 text-sm">
        {data.pageNumber > 1 && (
          <Link href={`/policies/${data.doc.id}/clause/${data.pageNumber - 1}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 hover:border-primary/40">
            <ChevronLeft className="size-4" aria-hidden="true" /> Page {data.pageNumber - 1}
          </Link>
        )}
        {data.pageNumber < data.doc.pageCount && (
          <Link href={`/policies/${data.doc.id}/clause/${data.pageNumber + 1}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 hover:border-primary/40">
            Page {data.pageNumber + 1} <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
        <a
          href={`/policies/${data.doc.id}/pdf#page=${data.pageNumber}`}
          target="_blank"
          rel="noopener"
          className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
        >
          <FileText className="size-4" aria-hidden="true" /> Open the original PDF at this page ↗
        </a>
      </nav>

      <article
        aria-label={`Text of page ${data.pageNumber}`}
        className="whitespace-pre-wrap break-words rounded-2xl border bg-background/90 p-6 font-mono text-[13px] leading-relaxed"
      >
        {before}
        {range && (
          <mark id="clause" className="rounded bg-primary/15 px-0.5 text-foreground ring-1 ring-primary/30">
            {marked}
          </mark>
        )}
        {after}
      </article>
      <p className="text-xs text-muted-foreground">Text as read from the PDF, so the layout may differ from the original. Open the original to see it as printed.</p>
    </div>
  );
}
