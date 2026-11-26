// Coverage status labels and colours, shared by the policy page and the comparison.
export const STATUS_TEXT: Record<string, { text: string; className: string }> = {
  COVERED: { text: "Covered", className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  LIMITED: { text: "Limited", className: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  NOT_COVERED: { text: "Not covered", className: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  NOT_MENTIONED: { text: "Not mentioned", className: "bg-muted text-muted-foreground" },
};
