import { Badge } from "@/components/ui/badge";

const LABEL: Record<string, { text: string; variant: "secondary" | "outline" | "destructive" }> = {
  UPLOADED: { text: "Ready to analyse", variant: "outline" },
  ANALYSING: { text: "Analysing…", variant: "outline" },
  READY: { text: "Analysed", variant: "secondary" },
  FAILED: { text: "Analysis failed", variant: "destructive" },
  SCANNED: { text: "Scanned PDF", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = LABEL[status] ?? { text: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.text}</Badge>;
}
