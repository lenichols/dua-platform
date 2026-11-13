import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell } from "@/components/shell";
import { RubricBar, SignInLayout } from "@/components/sign-in-layout";
import { sampleJudgeLogins } from "@/server/demo";
import { getCurrentEvent } from "@/server/event";
import { getJudgeSession } from "./auth";
import { JudgingNotOpen } from "./judging-not-open";
import { JudgeSignIn } from "./sign-in";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const event = await getCurrentEvent();
  const phase = event.phase;
  // Judges and mentors aren't let in until an organizer opens judging.
  const notOpen = phase === "submissions";
  if (!notOpen && (await getJudgeSession())) redirect("/judge/dashboard");

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-accent hover:text-accent">
            ← Home
          </Link>
        }
      />
      <PageShell maxWidth="max-w-5xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Judge Sign In" },
          ]}
        />
        {notOpen ? (
          <div className="mx-auto max-w-md">
            <JudgingNotOpen />
          </div>
        ) : (
          <SignInLayout
            status={phase === "judging" ? "Judging is open" : "Results are in"}
            title="Judge Sign In"
            intro="For judges and mentors. Sign in with the email the organizers have on the roster."
            aside={<RubricBar criteria={event.settings.rubric.criteria} topN={event.settings.topN} />}
          >
            <JudgeSignIn samples={await sampleJudgeLogins(event.id)} />
          </SignInLayout>
        )}
      </PageShell>
    </>
  );
}
