import { getDocumentPdf, NotFoundError } from "@/lib/data/documents";
import { requireUserId } from "@/lib/session";

/** The owner's PDF, shown inline so "#page=N" links open at the cited page. */
export async function GET(_request: Request, { params }: RouteContext<"/policies/[id]/pdf">) {
  const { id } = await params;
  const userId = await requireUserId();
  try {
    const doc = await getDocumentPdf(userId, id);
    return new Response(Buffer.from(doc.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Not found", { status: 404 });
    throw error;
  }
}
