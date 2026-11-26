"use client";

import { FileUp } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { uploadAction, type ActionState } from "./actions";

const MAX_MB = 4;

export function UploadForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadAction, {});
  const [name, setName] = useState<string>();
  const [clientError, setClientError] = useState<string>();
  const [loadingSample, setLoadingSample] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = clientError ?? state.error;

  /** Load the fictional sample policy into the file input and submit, exactly like a real upload. */
  async function trySample() {
    setLoadingSample(true);
    try {
      const res = await fetch("/samples/example-secure-policy-wording.pdf");
      const file = new File([await res.blob()], "example-secure-policy-wording.pdf", { type: "application/pdf" });
      const dt = new DataTransfer();
      dt.items.add(file);
      if (inputRef.current) inputRef.current.files = dt.files;
      setName(file.name);
      setClientError(undefined);
      formRef.current?.requestSubmit();
    } catch {
      setClientError("Couldn't load the sample policy.");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <label
        htmlFor="file"
        className={cn(
          "grid cursor-pointer justify-items-center gap-2 rounded-2xl border-2 border-dashed bg-background/70 px-6 py-10 text-center transition-colors hover:border-primary/50",
          error && "border-destructive/50",
        )}
      >
        <FileUp className="size-7 text-primary" aria-hidden="true" />
        <span className="text-base font-medium">{name ?? "Choose your policy PDF"}</span>
        <span className="text-sm text-muted-foreground">
          The <strong>policy wording</strong> works best (from your insurer&apos;s website or email). Text PDFs up to {MAX_MB} MB.
        </span>
        <input
          ref={inputRef}
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setName(f?.name);
            setClientError(f && f.size > MAX_MB * 1024 * 1024 ? `That file is over ${MAX_MB} MB.` : undefined);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !name || Boolean(clientError)}
        className="inline-flex h-11 items-center justify-center justify-self-start rounded-full bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Reading the PDF…" : "Upload policy"}
      </button>
      <button
        type="button"
        onClick={trySample}
        disabled={pending || loadingSample}
        className="justify-self-start text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
      >
        No policy handy? Try a sample policy (fictional)
      </button>
      <p className="text-xs text-muted-foreground">
        Prefer the general policy wording over your personal schedule: it has the same rules without your health details.
      </p>
    </form>
  );
}
