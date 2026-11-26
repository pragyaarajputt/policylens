"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "./actions";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-muted-foreground hover:text-destructive">
        Delete my account and all its data
      </button>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-3 text-sm">
      This permanently deletes your account, every policy you uploaded and all answers. It can&apos;t be undone.
      <button type="button" disabled={pending} onClick={() => startTransition(() => deleteAccountAction())} className="font-medium text-destructive">
        {pending ? "Deleting…" : "Yes, delete everything"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-muted-foreground">
        Keep my account
      </button>
    </p>
  );
}
