"use client";

import { useActionState, useEffect, useState } from "react";
import { askAction, type ActionState } from "../actions";

const EXAMPLES = ["Is cataract surgery covered, and up to how much?", "Is there a co-payment if I'm treated in Mumbai?", "Are dental treatments covered?"];

export function AskForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(askAction, {});
  const [question, setQuestion] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [seenState, setSeenState] = useState(state);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  // Clear the box once an answer is saved (the list above refreshes with it).
  if (state !== seenState) {
    setSeenState(state);
    if (state.ok) setQuestion("");
  }

  return (
    <form action={action} onSubmit={() => setSeconds(0)} className="grid gap-3">
      <input type="hidden" name="documentId" value={documentId} />
      <label htmlFor="question" className="sr-only">
        Your question about this policy
      </label>
      <textarea
        id="question"
        name="question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        maxLength={300}
        required
        placeholder="e.g. Is cataract surgery covered, and up to how much?"
        className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || question.trim().length < 5}
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? `Reading the policy… ${seconds}s` : "Ask"}
        </button>
        {!pending &&
          EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setQuestion(ex)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary">
              {ex}
            </button>
          ))}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
