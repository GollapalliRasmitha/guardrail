import {
  ArrowRight,
  Bell,
  Bug,
  CreditCard,
  FileSearch,
  Gauge,
  KeyRound,
  Radar,
  ShieldCheck,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FlipCard } from "@/components/landing/FlipCard";
import { HeroGlobe } from "@/components/landing/HeroGlobe";
import { buttonClass } from "@/components/ui/Button";
import type { RuleId } from "@/lib/alerts/types";
import { RULES } from "@/lib/detection/rules";

// Public home page: what GuardRail is, a live globe of attacks (country-level only), the six rules, the demo.

const CARD: Record<RuleId, { icon: LucideIcon; fires: string }> = {
  brute_force: { icon: KeyRound, fires: "10 or more wrong passwords for one account within 10 minutes." },
  credential_stuffing: {
    icon: Bug,
    fires: "One IP fails on 5 or more different accounts within 10 minutes.",
  },
  forged_webhook: { icon: CreditCard, fires: "Any payment notification whose signature doesn't match." },
  scanning: {
    icon: Radar,
    fires: "Any request for a scanner path; medium once one IP asks for 5 in 5 minutes.",
  },
  flood: { icon: Gauge, fires: "One IP hits the rate limit 50 times within a minute." },
  new_ip_login: { icon: UserRoundSearch, fires: "A sign-in from an IP the account hasn't used in 30 days." },
};

const STEPS = [
  {
    icon: ShieldCheck,
    title: "Signed events",
    text: "Each site sends what happened (failed sign-ins, scans, forged payments), signed with its own secret. Unsigned, changed or replayed requests are refused.",
  },
  {
    icon: FileSearch,
    title: "Detection rules",
    text: "Six rules mapped to MITRE ATT&CK look for patterns across events: per account, per IP or per site.",
  },
  {
    icon: Bell,
    title: "Alerts",
    text: "One alert per attack, with evidence, advice and a timeline. High alerts also send an email. Visitors never wait for any of it.",
  },
];

export default function Home() {
  return (
    <div className="grid-ground min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/signin" className={buttonClass("ghost")}>
          Owner sign-in
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-14">
          <div>
            <p className="eyebrow">Mini SIEM · MITRE ATT&amp;CK mapped</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] font-semibold sm:text-6xl">
              A control room for <span className="text-accent">two live websites.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              GuardRail receives signed security events from HomeHaat and Oppora, spots attacks as they happen
              and raises alerts. Built with Next.js, TypeScript and Postgres.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className={buttonClass("primary")}>
                Try the demo <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/signin" className={buttonClass("ghost")}>
                Open the console
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">The demo uses made-up data and is read-only.</p>
          </div>
          <HeroGlobe />
        </section>

        <section aria-labelledby="catches" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="eyebrow">Detection</p>
          <h2 id="catches" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            What it catches
          </h2>
          <p className="mt-2 max-w-2xl text-muted">Turn a card over to see exactly when each rule fires.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((rule) => {
              const { icon: Icon, fires } = CARD[rule.id];
              return (
                <li key={rule.id}>
                  <FlipCard
                    label={rule.name}
                    front={
                      <>
                        <Icon className="size-6 text-accent" aria-hidden />
                        <span className="mt-4 block font-display text-lg font-semibold">{rule.name}</span>
                        <span className="block font-mono text-xs text-accent">
                          {rule.mitre.id} · {rule.mitre.name}
                        </span>
                        <span className="mt-2 block text-sm text-muted">{rule.description}</span>
                      </>
                    }
                    back={
                      <>
                        <span className="eyebrow">Fires when</span>
                        <span className="mt-2 block font-display text-lg leading-snug">{fires}</span>
                        <span className="mt-auto block pt-4 text-sm text-muted">
                          First step: {rule.advice[0]}
                        </span>
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="eyebrow">Pipeline</p>
          <h2 id="how" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="glass rounded-xl p-5">
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent/10 font-mono text-sm text-accent">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-accent" aria-hidden />
                </span>
                <span className="mt-4 block font-display text-lg font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted">{text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link href="/demo" className={buttonClass("primary")}>
              See it with demo data <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-line px-4 py-8 text-sm text-muted sm:px-6">
        GuardRail · a portfolio project by Rasmitha. The globe shows countries only, never IP addresses.
      </footer>
    </div>
  );
}
