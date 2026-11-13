import Link from "next/link";
import { HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { EVENT } from "@/lib/site";

export const dynamic = "force-dynamic";

type Outcome = "done" | "already" | "invalid" | "missing";

async function unsubscribe(id: string, token: string): Promise<Outcome> {
  if (!id || !token) return "missing";
  if (!verifyUnsubscribeToken(id, token)) return "invalid";

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("registrations")
    .select("id, unsubscribed_at")
    .eq("id", id)
    .maybeSingle();

  if (!row) return "invalid";
  if (row.unsubscribed_at) return "already";

  const { error } = await admin
    .from("registrations")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return "invalid";
  return "done";
}

const COPY: Record<Outcome, { title: string; body: string }> = {
  done: {
    title: "You're unsubscribed",
    body: `You won't receive any more email updates about ${EVENT.name}. Your registration itself is unchanged — you're still signed up for the event.`,
  },
  already: {
    title: "Already unsubscribed",
    body: "You'd already opted out, so there's nothing more to do. You won't receive further email updates.",
  },
  invalid: {
    title: "That link didn't work",
    body: "This unsubscribe link is invalid or has expired. Reply to any of our emails and we'll take you off the list by hand.",
  },
  missing: {
    title: "Nothing to unsubscribe",
    body: "This page needs the unsubscribe link from one of our emails. Open that link directly and it'll work.",
  },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id = "", t = "" } = await searchParams;
  const outcome = await unsubscribe(id, t);
  const { title, body } = COPY[outcome];

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-crimson hover:text-crimson">
            ← Home
          </Link>
        }
      />
      <PageShell maxWidth="max-w-2xl">
        <div className="mx-auto max-w-xl">
          <SectionTitle
            center
            eyebrow="Email preferences"
            title={title}
            subtitle={body}
          />
          <div className="mt-6 text-center">
            <Link href="/" className="btn">
              Back to the hackathon
            </Link>
          </div>
        </div>
      </PageShell>
    </>
  );
}
