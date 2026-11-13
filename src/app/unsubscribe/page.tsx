import Link from "next/link";
import { HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { unsubscribeRegistration } from "@/server/registrations";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { getSettings } from "@/lib/current-settings";

export const dynamic = "force-dynamic";

type Outcome = "done" | "already" | "invalid" | "missing";

async function unsubscribe(id: string, token: string): Promise<Outcome> {
  if (!id || !token) return "missing";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyUnsubscribeToken(id, token)) return "invalid";

  return unsubscribeRegistration(id);
}

const copyFor = (eventName: string): Record<Outcome, { title: string; body: string }> => ({
  done: {
    title: "You're unsubscribed",
    body: `You won't receive any more email updates about ${eventName}. Your registration itself is unchanged — you're still signed up for the event.`,
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
});

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id = "", t = "" } = await searchParams;
  const outcome = await unsubscribe(id, t);
  const { title, body } = copyFor((await getSettings()).name)[outcome];

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-accent hover:text-accent">
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
