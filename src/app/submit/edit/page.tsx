import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getPhase, getSubmissionsOpen } from "@/lib/phase";
import { submissionSchema } from "@/lib/submission-schema";
import { verifyEditToken } from "@/lib/submission-edit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitForm } from "../submit-form";
import { EVENT } from "@/lib/site";

export const dynamic = "force-dynamic";

// Every field the form submits; each is a submissions column.
const FORM_FIELDS = Object.keys(submissionSchema.shape);

export default async function EditSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id = "", t = "" } = await searchParams;
  const valid = /^[0-9a-f-]{36}$/i.test(id) && verifyEditToken(id, t);

  // Same gate as /submit: closing submissions cuts off every edit link.
  const open =
    valid && (await getPhase()) === "submissions" && (await getSubmissionsOpen());

  let initial: Record<string, string> | null = null;
  if (valid && open) {
    const { data } = await createAdminClient()
      .from("submissions")
      .select(FORM_FIELDS.join(", "))
      .eq("id", id)
      .maybeSingle();
    if (data) {
      initial = {};
      for (const [k, v] of Object.entries(data as unknown as Record<string, unknown>)) {
        if (v != null && v !== "") initial[k] = String(v);
      }
    }
  }

  const problem = !valid
    ? {
        eyebrow: "Link Not Valid",
        title: "Check Your Link",
        subtitle:
          `This edit link is incomplete or incorrect. Open it straight from your confirmation email, or email ${EVENT.contactEmail} and we'll send it again.`,
      }
    : !open
      ? {
          eyebrow: "Submissions Closed",
          title: "Editing Has Closed",
          subtitle:
            "Submissions have closed, so submissions can no longer be edited. Your last saved version is the one judges will see.",
        }
      : !initial
        ? {
            eyebrow: "Not Found",
            title: "Submission Not Found",
            subtitle:
              `We couldn't find this submission. Email ${EVENT.contactEmail} if you think this is a mistake.`,
          }
        : null;

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
            { label: "Edit" },
          ]}
        />
        {problem || !initial ? (
          <div className="mx-auto max-w-xl text-center">
            <SectionTitle center {...problem!} />
            <div className="flex justify-center">
              <Link href="/" className="btn">
                ← Home
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-up">
              <div className="pill-crimson mb-3">Editing Your Submission</div>
              <h1 className="hex-title text-4xl md:text-5xl">
                {initial.project_name}
              </h1>
              <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70" />
            </div>

            <div className="card mb-6 space-y-3 border-l-4 border-l-crimson">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-crimson">⏰ Deadline</span>
                <span className="font-cond text-base font-semibold uppercase tracking-wider text-bone">
                  Edits close with submissions: {EVENT.submissionDeadline}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-bone/90">
                Your saved answers are filled in below. Change what you need,
                then review and save. Saving replaces your whole submission
                with what&apos;s on this page.
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

            <SubmitForm initial={initial} edit={{ id, token: t }} />
          </>
        )}
      </PageShell>
    </>
  );
}
