import Link from "next/link";
import { Footer, HeaderBar, PageShell, Wordmark } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { getSettings } from "@/lib/current-settings";

export const dynamic = "force-dynamic";

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

  // All of the copy below comes from the event's settings, edited in the
  // admin panel's Event tab.
  const EVENT = await getSettings();
  const TRACKS = EVENT.tracks;
  const PILLARS = EVENT.home.pillars;
  const TRACK_EXAMPLES: Record<string, string> = Object.fromEntries(
    EVENT.home.trackExamples.map((t) => [t.track, t.example]),
  );
  const FAQ = EVENT.home.faq;
  const INTRO = EVENT.home.intro.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const STATS = [
    { v: EVENT.prizes, l: "Prizes" },
    { v: EVENT.dates, l: "When" },
    { v: EVENT.format, l: "Where" },
    { v: `Up to ${EVENT.maxTeamSize}`, l: EVENT.maxTeamSize === 1 ? "Solo entries" : "People per team" },
  ].filter((x) => x.v);
  const STEPS = [
    { t: "Register", d: "Sign up and tell us how you'll compete — solo or as a team." },
    { t: "Build", d: EVENT.dates ? `Build your project during the event: ${EVENT.dates}.` : "Build your project during the event." },
    { t: "Submit", d: "Send your project, demo video, and details before the deadline." },
    { t: "Judging", d: "Judges score every entry against the same published rubric." },
    { t: "Results", d: EVENT.prizes ? `Top teams share ${EVENT.prizes}.` : "The top teams are announced." },
  ];

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
        {INTRO.length > 0 && (
          <section className="py-12">
            <SectionHead eyebrow="The Challenge" title={EVENT.home.introTitle || EVENT.name} />
            <div className="mx-auto max-w-3xl space-y-4">
              {INTRO.map((para, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "text-lg leading-relaxed text-bone/90"
                      : "text-sm leading-relaxed text-dust"
                  }
                >
                  {para}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* ---------- PILLARS ---------- */}
        <section className="py-12">
          <SectionHead
            eyebrow={EVENT.home.pillarsEyebrow}
            title={EVENT.home.pillarsTitle}
            sub={EVENT.home.pillarsSubtitle || undefined}
          />
          <div className="grid items-start gap-4 md:grid-cols-3">
            {PILLARS.map((p) => (
              <details
                key={p.title}
                className="card group overflow-hidden p-0 transition hover:border-crimson/60 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none">
                  <div className="p-5">
                    <h3 className="font-serif text-2xl text-bone">{p.title}</h3>
                    <p className="mt-2 text-sm text-dust">{p.text}</p>
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
                <div className="font-display text-2xl leading-tight text-crimson md:text-3xl">
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
