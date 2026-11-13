import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle, Wordmark } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { getJudgeSession } from "./auth";
import { JudgingNotOpen } from "./judging-not-open";
import { JudgeSignIn } from "./sign-in";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const phase = await getPhase();
  // Judges and mentors aren't let in until an organizer opens judging.
  const notOpen = phase === "submissions";
  if (!notOpen && (await getJudgeSession())) redirect("/judge/dashboard");

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-crimson hover:text-crimson">
            ← Home
          </Link>
        }
      />
      <PageShell maxWidth="max-w-md">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Judge Sign In" },
          ]}
        />
        {notOpen ? (
          <JudgingNotOpen />
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              <Wordmark className="text-3xl md:text-4xl" />
            </div>
            <SectionTitle
              center
              eyebrow={phase === "judging" ? "Phase 2 · Judging Open" : `Phase: ${phase}`}
              title="Judge Sign In"
              subtitle="Judges and mentors: sign in with your email and the password from the organizers. Only emails on the roster will work."
            />
            <JudgeSignIn />
          </>
        )}
      </PageShell>
    </>
  );
}
