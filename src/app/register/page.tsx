import Link from "next/link";
import {
  Breadcrumbs,
  HeaderBar,
  PageShell,
  SectionTitle,
} from "@/components/shell";
import { getPhase, getRegistrationOpen } from "@/lib/phase";
import { RegisterForm } from "./register-form";
import { getSettings } from "@/lib/current-settings";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const EVENT = await getSettings();
  const phase = await getPhase();
  const open = phase === "submissions" && (await getRegistrationOpen());

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-crimson hover:text-crimson">
            ← Home
          </Link>
        }
      />
      <PageShell>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Register" }]}
        />

        {!open ? (
          <div className="mx-auto max-w-xl text-center">
            <SectionTitle
              center
              eyebrow="Registration Closed"
              title="The Build Is On"
              subtitle={`Registration has closed for ${EVENT.name}. Thank you to everyone who signed up.`}
            />
            <div className="flex justify-center gap-3">
              <Link href="/" className="btn">
                ← Home
              </Link>
              {phase === "results" && (
                <Link href="/results" className="btn-crimson">
                  View Results
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-up">
              <div className="pill-crimson mb-3">Free · 100% Virtual</div>
              <h1 className="hex-title text-4xl md:text-5xl">
                Register for {EVENT.name}
              </h1>
              <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70" />
            </div>

            <div className="card mb-6 space-y-3 border-l-4 border-l-crimson">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-crimson">🌍 {EVENT.dates}</span>
                <span className="font-cond text-base font-semibold uppercase tracking-wider text-bone">
                  Powering the world&apos;s next breakthrough
                </span>
              </div>
              <p className="text-sm leading-relaxed text-bone/90">
                Reserve your spot now — it&apos;s free. Registration takes a
                minute, and we&apos;ll send you everything you need before the
                event, including your{" "}
                <strong className="text-crimson">project submission link</strong>
                . Compete solo or as a team for{" "}
                <strong className="text-crimson">{EVENT.prizes}</strong>.
              </p>
            </div>

            <RegisterForm />
          </>
        )}
      </PageShell>
    </>
  );
}
