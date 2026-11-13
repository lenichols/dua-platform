import Link from "next/link";
import {
  Breadcrumbs,
  HeaderBar,
  PageShell,
  SectionTitle,
} from "@/components/shell";
import { getPhase, getRegistrationOpen } from "@/lib/phase";
import { MentorForm } from "./mentor-form";
import { EVENT } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function MentorPage() {
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
          items={[{ label: "Home", href: "/" }, { label: "Mentor" }]}
        />

        {!open ? (
          <div className="mx-auto max-w-xl text-center">
            <SectionTitle
              center
              eyebrow="Mentor Sign-Up Closed"
              title="The Build Is On"
              subtitle={`Mentor sign-up has closed for ${EVENT.name}. If you already signed up, we'll be in touch.`}
            />
            <div className="flex justify-center gap-3">
              <Link href="/" className="btn">
                ← Home
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-up">
              <div className="pill-crimson mb-3">Volunteer · 100% Virtual</div>
              <h1 className="hex-title text-4xl md:text-5xl">
                Mentor at {EVENT.name}
              </h1>
              <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70" />
            </div>

            <div className="card mb-6 space-y-3 border-l-4 border-l-crimson">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-crimson">
                  🌍 {EVENT.dates}
                </span>
                <span className="font-cond text-base font-semibold uppercase tracking-wider text-bone">
                  Help a team ship something real
                </span>
              </div>
              <p className="text-sm leading-relaxed text-bone/90">
                Every team selects a mentor during the event. Share your
                expertise in engineering, business, or policy — help a team
                sharpen their problem statement, pressure-test their
                solution, and ship something real before the deadline. Your
                profile will be shared with participants once registration
                opens.
              </p>
            </div>

            <MentorForm />
          </>
        )}
      </PageShell>
    </>
  );
}
