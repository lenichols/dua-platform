import Link from "next/link";
import { Footer, HeaderBar, PageShell, Wordmark } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { TRACKS } from "@/lib/hackathon";
import { EVENT } from "@/lib/site";

export const dynamic = "force-dynamic";

// Sample homepage copy for the made-up event in src/lib/site.ts.
// Replace it with your own.
const PILLARS = [
  {
    k: "Useful",
    d: "Solve a real problem for real people, and say who they are.",
    example:
      "A food bank coordinates 40 volunteers by group chat and loses track of who is coming. Build something that tells the organizer, each morning, which shifts are still empty.",
  },
  {
    k: "Original",
    d: "Bring a new angle, not a copy of something that already exists.",
    example:
      "Plenty of apps show bus times. Build one for a rider who can't look at a screen: it speaks the next departure and nothing else.",
  },
  {
    k: "Working",
    d: "Show it running. A rough demo beats a polished slide.",
    example:
      "Record three minutes of someone outside your team using it from start to finish, with no one helping them.",
  },
];

// Example problem statements per challenge track, keyed by the shared TRACKS
// strings in src/lib/hackathon.ts (which the forms also use — don't rename).
const TRACK_EXAMPLES: Record<string, string> = {
  "Web & Mobile Apps":
    "Build an app a neighbourhood group could start using on Monday without any training.",
  "AI & Data":
    "Take a public dataset nobody reads and turn it into an answer to one question people keep asking.",
  "Hardware & Devices":
    "Build a device under $30 in parts that tells you something useful about the room it's in.",
  "Developer Tools":
    "Remove one step that every developer on your team repeats by hand each day.",
  "Social Good":
    "Pick one local organization, ask what slows them down most, and build for that.",
};

const STATS = [
  { v: EVENT.prizes.split(" ")[0], l: "In prizes" },
  { v: "3 Days", l: EVENT.dates },
  { v: "100%", l: "Virtual & global" },
  { v: "Free", l: "To enter" },
];

const STEPS = [
  { t: "Register", d: "Sign up free and tell us how you'll compete — solo or as a team." },
  { t: "Build", d: `Pick your mentor, then build over the event: ${EVENT.dates}.` },
  { t: "Submit", d: "Send your project, demo video, and details before the deadline." },
  { t: "Judging", d: "Judges score every entry against the same published rubric." },
  { t: "Win", d: `Top teams share ${EVENT.prizes}.` },
];

const FAQ = [
  {
    q: "Who can participate?",
    a: "Anyone, anywhere — students, professionals, founders, and first-time hackers. It's virtual and free to join.",
  },
  {
    q: "Do I need a team?",
    a: `No. Compete solo or form a team of up to ${EVENT.maxTeamSize} people. You can register now and finalize your team later.`,
  },
  {
    q: "What should I build?",
    a: "Anything that fits one of the challenge tracks. Pick one of the problem briefs or bring a problem of your own.",
  },
  {
    q: "How much does it cost?",
    a: "Nothing. Registration and participation are free.",
  },
  {
    q: "How is judging kept fair?",
    a: "Every judge scores against the same rubric and writes one sentence of evidence per score. Scores are normalized per judge, so a harsh judge and a generous one carry the same weight, and judges recuse themselves from projects where they have a conflict.",
  },
];

function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-8 text-center">
      <div className="mb-2 font-cond text-[0.7rem] uppercase tracking-[0.3em] text-crimson">
        {eyebrow}
      </div>
      <h2 className="hex-title text-3xl md:text-4xl">{title}</h2>
      {sub && <p className="mx-auto mt-3 max-w-2xl text-dust">{sub}</p>}
      <div className="mx-auto mt-4 h-[2px] w-24 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70" />
    </div>
  );
}

export default async function Home() {
  const phase = await getPhase();

  const hero = {
    submissions: {
      primary: { label: "Register Now", href: "/register" },
      note: "Registration open · Free to enter",
    },
    judging: {
      primary: { label: "Judge Sign In", href: "/judge" },
      note: "Registration & submissions are closed — judging in progress",
    },
    results: {
      primary: { label: "View the Winners", href: "/results" },
      note: "The results are in",
    },
  }[phase];

  return (
    <>
      <HeaderBar
        rightSlot={
          <>
            <Link
              href="/mentor"
              className="pill whitespace-nowrap hover:border-crimson hover:text-crimson"
            >
              Become a Mentor
            </Link>
            <Link href="/register" className="pill-crimson hover:brightness-110">
              Register
            </Link>
          </>
        }
      />

      {/* ---------- HERO ---------- */}
      <section className="theme-dark relative overflow-hidden border-b border-line bg-ink">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--ink-5))_0%,rgb(var(--ink))_70%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-16 text-center md:py-24">
          <h1 className="animate-fade-up">
            <Wordmark className="text-5xl md:text-7xl" />
          </h1>
          <p className="mt-5 animate-fade-up font-serif text-2xl leading-tight text-bone md:text-3xl">
            {EVENT.tagline}
          </p>

          <div className="mt-7 animate-fade-up">
            <div className="font-display text-3xl leading-none tracking-wide text-bone md:text-5xl">
              {EVENT.dates}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-[0.7rem] uppercase tracking-[0.3em] text-dust">
              <span className="h-px w-8 bg-line" />
              {EVENT.format}
              <span className="h-px w-8 bg-line" />
            </div>
          </div>

          <p className="mt-4 max-w-xl animate-fade-up text-sm text-dust">
            Hosted by {EVENT.host.name} · {EVENT.prizes}
          </p>

          <Link
            href={hero.primary.href}
            className="btn-crimson mt-8 h-14 px-10 text-base animate-fade-up"
          >
            {hero.primary.label} →
          </Link>
          <div className="mt-4 animate-fade-up font-cond text-[0.7rem] uppercase tracking-[0.3em] text-dust">
            {hero.note}
          </div>
        </div>
      </section>

      <PageShell maxWidth="max-w-5xl">
        {/* ---------- ABOUT THE EVENT ---------- */}
        <section className="py-12">
          <SectionHead eyebrow="The Challenge" title="What Is This Hackathon?" />
          <div className="mx-auto max-w-3xl space-y-4">
            <p className="text-lg leading-relaxed text-bone/90">
              {EVENT.name} is a time-bound competition where teams of
              students, engineers, founders and community innovators design
              and prototype practical solutions to real problems. You build
              and defend a working concept under deadline pressure, not just
              discuss ideas.
            </p>
            <p className="text-sm leading-relaxed text-dust">
              This is a sample event. Everything on this page, from the name
              and dates to the tracks below, is placeholder copy that ships
              with the platform so you can see how an event looks before you
              set up your own.
            </p>
          </div>
        </section>

        {/* ---------- PILLARS ---------- */}
        <section className="py-12">
          <SectionHead
            eyebrow="What Counts"
            title="Useful, Original, Working"
            sub="The three things judges look for in every entry."
          />
          <div className="grid items-start gap-4 md:grid-cols-3">
            {PILLARS.map((p) => (
              <details
                key={p.k}
                className="card group overflow-hidden p-0 transition hover:border-crimson/60 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none">
                  <div className="p-5">
                    <h3 className="font-serif text-2xl text-bone">{p.k}</h3>
                    <p className="mt-2 text-sm text-dust">{p.d}</p>
                    <div className="mt-3 font-cond text-[0.7rem] font-semibold uppercase tracking-wider text-crimson">
                      <span className="group-open:hidden">
                        Example +
                      </span>
                      <span className="hidden group-open:inline">
                        Example −
                      </span>
                    </div>
                  </div>
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <p className="text-sm leading-relaxed text-bone/90">
                    {p.example}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- TRACKS ---------- */}
        <section className="py-12">
          <SectionHead
            eyebrow="Build Anything"
            title="Challenge Tracks"
            sub="Software, data, hardware or tooling — there's a lane for every kind of builder."
          />
          <div className="grid items-start gap-4 md:grid-cols-2">
            {TRACKS.map((t) => (
              <details
                key={t}
                className="group rounded-xl border border-line bg-ink-3 transition hover:border-crimson/60 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <span className="font-display text-2xl text-crimson">⬡</span>
                  <span className="flex-1 font-cond text-sm font-semibold uppercase tracking-wide text-bone">
                    {t}
                  </span>
                  <span className="text-crimson transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                {TRACK_EXAMPLES[t] && (
                  <div className="border-t border-line px-4 py-3">
                    <div className="mb-1 font-cond text-[0.65rem] font-semibold uppercase tracking-wider text-crimson">
                      Example problem statement
                    </div>
                    <p className="text-sm leading-relaxed text-dust">
                      {TRACK_EXAMPLES[t]}
                    </p>
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>

        {/* ---------- STATS ---------- */}
        <section className="py-12">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l} className="card text-center">
                <div className="font-display text-4xl text-crimson md:text-5xl">
                  {s.v}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-dust">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="py-12">
          <SectionHead eyebrow="How It Works" title="From Idea to Impact" />
          <ol className="grid gap-4 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.t} className="card">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-crimson-dark to-crimson font-display text-lg text-white shadow-crimson">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-cond text-base font-bold uppercase tracking-wide text-bone">
                  {s.t}
                </h3>
                <p className="mt-1 text-xs text-dust">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="py-12">
          <SectionHead eyebrow="Questions" title="Frequently Asked" />
          <div className="mx-auto max-w-3xl space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="card group [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-cond text-base font-semibold text-bone">
                  {f.q}
                  <span className="text-crimson transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-dust">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- FINAL CTA ---------- */}
        <section className="theme-dark relative my-8 overflow-hidden rounded-2xl border border-crimson/40 bg-ink">
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink-4 to-crimson/30" />
          <div className="relative p-8 text-center md:p-14">
            <h2 className="hex-title text-3xl md:text-4xl">{EVENT.tagline}</h2>
            <p className="mx-auto mt-3 max-w-xl text-bone/90">
              Join builders from around the world. It&apos;s free, it&apos;s
              virtual, and it starts with one click.
            </p>
            <Link
              href={hero.primary.href}
              className="btn-crimson mt-7 h-14 px-10 text-base"
            >
              {hero.primary.label} →
            </Link>
          </div>
        </section>
      </PageShell>

      <Footer />
    </>
  );
}
