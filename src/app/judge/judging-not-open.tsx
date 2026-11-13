import Link from "next/link";
import { SectionTitle } from "@/components/shell";
import { EVENT } from "@/lib/site";

// Shown to judges and mentors in place of sign-in, the dashboard and
// submission pages until an organizer switches the phase to judging.
export function JudgingNotOpen() {
  return (
    <div className="mx-auto max-w-xl text-center">
      <SectionTitle
        center
        eyebrow="Judging Hasn't Started"
        title="Not Quite Yet"
        subtitle={`Judging opens ${EVENT.judgingOpens}. Once the organizers open judging, you'll be able to sign in here and see the submissions.`}
      />
      <div className="flex justify-center">
        <Link href="/" className="btn">
          ← Home
        </Link>
      </div>
    </div>
  );
}
