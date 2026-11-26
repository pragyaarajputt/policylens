import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="26 November 2026">
      <p>
        PolicyLens reads health insurance policy documents you upload and explains what they say. This page explains what we
        store and why, in line with India&apos;s Digital Personal Data Protection Act, 2023.
      </p>
      <section className="grid gap-2">
        <h2>Upload the policy wording, not your personal papers</h2>
        <p>
          PolicyLens works best with the general <strong>policy wording</strong> published by your insurer. It has the same rules
          as your policy, without your name, health details or policy number. Please don&apos;t upload medical records, claim
          papers or documents with other people&apos;s details.
        </p>
      </section>
      <section className="grid gap-2">
        <h2>What we store</h2>
        <ul>
          <li>Your account: email address and name, from Google sign-in.</li>
          <li>Documents you upload: the PDF file and the text of each page, so every answer can be checked against its page.</li>
          <li>What PolicyLens works out: the 20 answers, their quotes, and the questions you ask with their answers.</li>
          <li>Abuse protection: short-lived counters of uploads and questions, keyed by a one-way hash, not your raw address.</li>
        </ul>
      </section>
      <section className="grid gap-2">
        <h2>Who processes it</h2>
        <ul>
          <li>
            <strong>Google Gemini</strong> reads the document text and your questions to produce answers. PolicyLens uses
            Gemini&apos;s free tier, under which Google may use submitted content to improve its products. This is one more
            reason to upload the general policy wording rather than personal documents.
          </li>
          <li>Our hosting (Vercel) and database (Neon) providers store and serve your data to run PolicyLens.</li>
          <li>Google sign-in confirms your email address. We don&apos;t get your Google password or other Google data.</li>
        </ul>
      </section>
      <section className="grid gap-2">
        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t sell or rent your data, and we don&apos;t show ads.</li>
          <li>We don&apos;t share your documents with insurers, agents or brokers, and we don&apos;t sell or recommend policies.</li>
        </ul>
      </section>
      <section className="grid gap-2">
        <h2>Your rights</h2>
        <ul>
          <li>Access: everything you uploaded and every answer is shown in the app, and you can download each original PDF.</li>
          <li>Erasure: delete any policy, with its pages, answers and questions, from its page. Delete your whole account and all its data from the bottom of My policies.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
