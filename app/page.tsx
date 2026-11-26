import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const traps = [
  { title: "Room-rent caps", body: "A 1% cap on a ₹5L policy means ₹5,000 a day. Take a ₹8,000 room and most of the bill is cut, not just the room." },
  { title: "Co-pay and deductibles", body: "Some policies make you pay 10–30% of every claim, often only above a certain age or in certain cities." },
  { title: "Waiting periods", body: "Existing illnesses, cataract, hernia, maternity: 2 to 4 years before you're covered." },
];

const steps = [
  { title: "Upload your policy wording", body: "The PDF from your insurer's website or welcome email. We read all of it, page by page." },
  { title: "Get 20 straight answers", body: "Room rent, co-pay, waiting periods, sub-limits, consumables and more, in plain English." },
  { title: "Check the clause yourself", body: "Every answer quotes the policy with its page number, highlighted on the page. If we can't find the quote in the PDF, we don't show it as fact." },
  { title: "Ask, and compare", body: "Ask your own questions, answered only from your policy. Put two or three policies side by side to see where they really differ." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <Link href="/login" className="inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            Log in
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <section className="hero-wash">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
            <p className="eyebrow">For families in India choosing health insurance</p>
            <h1 className="display text-[3rem] sm:text-7xl">
              Know what&apos;s covered
              <br />
              <em>before the claim.</em>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Upload your health insurance policy. PolicyLens finds the room-rent cap, co-pay, waiting periods and sub-limits, and
              shows you the exact clause for every answer.
            </p>
            <Link href="/login" className="inline-flex h-12 items-center gap-2 justify-self-start rounded-full bg-primary px-7 text-base font-medium text-primary-foreground hover:opacity-90">
              Read my policy <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section aria-label="Common claim traps" className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="grid gap-6 border-y py-10 md:grid-cols-3">
            {traps.map((t) => (
              <div key={t.title} className="grid content-start gap-2">
                <h2 className="text-lg font-medium">{t.title}</h2>
                <p className="leading-relaxed text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="How it works" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <ol className="divide-y">
            {steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3.25rem_1fr] gap-x-4 py-8 sm:grid-cols-[5rem_1fr]">
                <span className="display text-2xl italic text-muted-foreground" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="grid gap-2">
                  <h2 className="text-xl font-medium">{s.title}</h2>
                  <p className="text-lg leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-12 pt-4 text-sm leading-relaxed text-muted-foreground sm:px-6">
        <p>PolicyLens explains what your policy document says. It isn&apos;t insurance advice and doesn&apos;t sell or recommend policies.</p>
        <nav aria-label="Legal" className="mt-3 flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <a href="https://github.com/pragyaarajputt/policylens" className="hover:text-foreground">Source code</a>
        </nav>
      </footer>
    </div>
  );
}
