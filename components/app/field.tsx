import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  className,
  ...props
}: { label: string; name: string; error?: string; hint?: string } & ComponentProps<typeof Input>) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={className}>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </Field>
  );
}
