"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { AiError } from "@/lib/ai/gemini";
import { analyseDocument, askQuestion, deleteAccount, deleteDocument, setCoverDates, NotFoundError, PolicyRuleError, uploadDocument } from "@/lib/data/documents";
import { PdfError } from "@/lib/pdf";
import { requireUserId } from "@/lib/session";

export type ActionState = { ok?: boolean; error?: string; id?: string };

/** Expected problems become a friendly message; anything unexpected is rethrown so it gets logged. */
function friendly(error: unknown): ActionState {
  if (error instanceof PdfError || error instanceof PolicyRuleError || error instanceof NotFoundError) return { error: error.message };
  if (error instanceof AiError) {
    console.warn(`[ai] policy analysis failed: ${error.kind} ${error.detail ?? ""}`);
    return { error: error.message };
  }
  throw error;
}

export async function uploadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF of your policy." };
  let id: string;
  try {
    ({ id } = await uploadDocument(userId, file.name, new Uint8Array(await file.arrayBuffer())));
  } catch (error) {
    return friendly(error);
  }
  redirect(`/policies/${id}`);
}

export async function analyseAction(documentId: string): Promise<ActionState> {
  const userId = await requireUserId();
  try {
    await analyseDocument(userId, documentId);
  } catch (error) {
    const result = friendly(error);
    refresh(); // show the FAILED status
    return result;
  }
  refresh();
  return { ok: true };
}

export async function askAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const documentId = String(form.get("documentId") ?? "");
  const question = String(form.get("question") ?? "");
  try {
    await askQuestion(userId, documentId, question);
  } catch (error) {
    return friendly(error);
  }
  refresh();
  return { ok: true };
}

export async function coverDatesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  try {
    await setCoverDates(userId, String(form.get("documentId") ?? ""), String(form.get("start") ?? ""), Number(form.get("prior") || 0));
  } catch (error) {
    return friendly(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteAction(documentId: string): Promise<ActionState> {
  const userId = await requireUserId();
  try {
    await deleteDocument(userId, documentId);
  } catch (error) {
    return friendly(error);
  }
  redirect("/policies");
}

export async function deleteAccountAction() {
  const userId = await requireUserId();
  await deleteAccount(userId);
  await signOut({ redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
