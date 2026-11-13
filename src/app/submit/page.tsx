import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getPhase, getSubmissionsOpen } from "@/lib/phase";
import { SubmitForm } from "./submit-form";
import { EVENT } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const phase = await getPhase();
  const submissionsOpen = await getSubmissionsOpen();
  const open = phase === "submissions" && submissionsOpen;
  // Distinguish "not opened yet" (still in submissions phase) from "closed
  // for good" (event moved on to judging/results).
  const notYet = phase === "submissions" && !submissionsOpen;

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
          items={[
            { label: "Home", href: "/" },
            { label: "Submit" },
          ]}
        />
        {!open ? (
          <div className="mx-auto max-w-xl text-center">
            <SectionTitle
              center
              eyebrow={notYet ? "Submissions Not Open Yet" : "Submissions Closed"}
              title={notYet ? "Hang Tight" : "You're Past The Buzzer"}
              subtitle={
                notYet
                  ? "The project submission form isn't open yet. Make sure you're registered — we'll send you the link the moment it opens."
                  : "Submissions are no longer being accepted. If you're a registered judge, head to your scoring dashboard."
              }
            />
            <div className="flex justify-center gap-3">
              <Link href="/" className="btn">
                ← Home
              </Link>
              {notYet ? (
                <Link href="/register" className="btn-crimson">
                  Register
                </Link>
              ) : (
                <Link href="/judge" className="btn-crimson">
                  Judge Sign In
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-up">
              <div className="pill-crimson mb-3">Phase 1 · Submissions Open</div>
              <h1 className="hex-title text-4xl md:text-5xl">
                {EVENT.name} Submission Form
              </h1>
              <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70" />
            </div>

            <div className="card mb-6 space-y-3 border-l-4 border-l-crimson">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-crimson">⏰ Deadline</span>
                <span className="font-cond text-base font-semibold uppercase tracking-wider text-bone">
                  Submissions close {EVENT.submissionDeadline}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-bone/90">
                All required fields must be complete for your entry to be
                reviewed. <strong className="text-crimson">One submission per team
                or solo participant.</strong> Please ensure all participant, team,
                project demo, and LinkedIn post details are included.
              </p>
              <p className="text-xs text-dust">
                Need help? Email{" "}
                <a
                  href={`mailto:${EVENT.contactEmail}`}
                  className="text-crimson underline"
                >
                  {EVENT.contactEmail}
                </a>
                .
              </p>
            </div>

            <SubmitForm />
          </>
        )}
      </PageShell>
    </>
  );
}
