"use client";

import { useEffect, useState, useTransition } from "react";
import { analyseAction, deleteAction } from "../actions";

export function AnalyseButton({ documentId, label = "Analyse this policy" }: { documentId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setSeconds(0);
          startTransition(async () => {
            setError(undefined);
            const r = await analyseAction(documentId);
            if (r.error) setError(r.error);
          });
        }}
        className="inline-flex h-11 items-center rounded-full bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? `Reading every clause… ${seconds}s` : label}
      </button>
      {pending && <p className="text-sm text-muted-foreground">Usually 20–60 seconds. Every quote is then checked against the PDF.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeletePolicyButton({ documentId }: { documentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-muted-foreground hover:text-destructive">
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      Delete this policy and its analysis?
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await deleteAction(documentId)))}
        className="font-medium text-destructive"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-muted-foreground">
        Keep
      </button>
    </span>
  );
}
