import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listDocuments } from "@/lib/data/documents";
import { requireUserId } from "@/lib/session";
import { StatusBadge } from "./status-badge";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "My policies" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default function PoliciesPage() {
  return (
    <div className="grid gap-10">
      <div className="grid gap-2">
        <p className="eyebrow">My policies</p>
        <h1 className="display text-5xl">
          What are you <em>really</em> covered for?
        </h1>
      </div>
      <div className="max-w-2xl">
        <UploadForm />
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your policies…</p>}>
        <PolicyList />
      </Suspense>
    </div>
  );
}

async function PolicyList() {
  const userId = await requireUserId();
  const docs = await listDocuments(userId);
  if (docs.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h2 className="font-medium">Uploaded</h2>
      <ul className="divide-y rounded-2xl border bg-background/80">
        {docs.map((d) => (
          <li key={d.id}>
            <Link href={`/policies/${d.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted/40">
              <span className="font-medium">{d.planName ?? d.filename}</span>
              {d.insurer && <span className="text-sm text-muted-foreground">{d.insurer}</span>}
              <span className="text-sm text-muted-foreground">
                {d.pageCount} pages · {dateFmt.format(d.createdAt)}
              </span>
              <span className="ml-auto">
                <StatusBadge status={d.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
