import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="26 November 2026">
      <p>PolicyLens is a free tool that explains what a health insurance policy document says. By using it you agree to these terms.</p>
      <section className="grid gap-2">
        <h2>Not insurance advice</h2>
        <ul>
          <li>PolicyLens is not an insurer, agent, broker or IRDAI-registered intermediary. It doesn&apos;t sell, recommend or compare the price of policies.</li>
          <li>Answers are produced by AI and can be wrong or incomplete, even when a quote is verified. The policy document and your insurer&apos;s decision are what count.</li>
          <li>Before relying on an answer for a claim, a purchase or a renewal, read the clause yourself and confirm with your insurer.</li>
        </ul>
      </section>
      <section className="grid gap-2">
        <h2>Your uploads</h2>
        <ul>
          <li>Only upload documents you have the right to use. Policy wordings published by insurers are fine for your own reading.</li>
          <li>Don&apos;t upload other people&apos;s personal or medical information.</li>
          <li>Don&apos;t try to misuse the service, for example by overloading it or getting around its limits.</li>
        </ul>
      </section>
      <section className="grid gap-2">
        <h2>Availability</h2>
        <p>PolicyLens is provided as is, without guarantees. We may limit use, change features or stop the service.</p>
      </section>
    </LegalPage>
  );
}
