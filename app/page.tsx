import { ArrowRight, Bug, KeyRound, Radar, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";

// Public home page. Stage 6 replaces the hero with the 3D globe and adds "Try the demo".
const catches = [
  { icon: KeyRound, title: "Brute force", mitre: "T1110", text: "Many wrong passwords for one account." },
  { icon: Bug, title: "Credential stuffing", mitre: "T1110.004", text: "One IP trying many accounts." },
  { icon: ShieldAlert, title: "Forged webhooks", mitre: "T1565", text: "Fake “payment captured” calls." },
  { icon: Radar, title: "Scanning", mitre: "T1595", text: "Bots probing /wp-admin and /.env." },
];

export default function Home() {
  return (
    <div className="grid-ground min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/signin" className={buttonClass("ghost")}>
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-24">
        <p className="eyebrow">Mini SIEM · MITRE ATT&amp;CK mapped</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] font-semibold sm:text-6xl">
          A control room for <span className="text-accent">two live websites.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          GuardRail receives signed security events from HomeHaat and Oppora, spots attacks as they happen,
          and raises alerts. Built with Next.js, TypeScript and Postgres.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signin" className={buttonClass("primary")}>
            Open the console <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <h2 className="mt-20 font-display text-xl font-semibold">What it catches</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {catches.map(({ icon: Icon, title, mitre, text }) => (
            <li key={mitre} className="rounded-xl border border-line bg-panel/80 p-5 backdrop-blur">
              <Icon className="size-5 text-accent" aria-hidden />
              <p className="mt-3 font-display font-semibold">{title}</p>
              <p className="font-mono text-xs text-muted">{mitre}</p>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
