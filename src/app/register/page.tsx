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
          <Link href="/" className="pill hover:border-accent hover:text-accent">
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
                <Link href="/results" className="btn-accent">
                  View Results
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="pill-accent mb-3">Free · 100% Virtual</div>
              <h1 className="hex-title text-4xl md:text-5xl">
                Register for {EVENT.name}
              </h1>
            </div>

            <div className="card mb-6 space-y-3 border-l-4 border-l-accent">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-accent">{EVENT.dates}</span>
                <span className="text-base font-semibold text-bone">
                  Powering the world&apos;s next breakthrough
                </span>
              </div>
              <p className="text-sm leading-relaxed text-bone/90">
                Reserve your spot now — it&apos;s free. Registration takes a
                minute, and we&apos;ll send you everything you need before the
                event, including your{" "}
                <strong className="text-accent">project submission link</strong>
                . Compete solo or as a team for{" "}
                <strong className="text-accent">{EVENT.prizes}</strong>.
              </p>
            </div>

            <RegisterForm />
          </>
        )}
      </PageShell>
    </>
  );
}
