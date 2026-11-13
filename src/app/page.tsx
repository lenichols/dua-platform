import Link from "next/link";
import { Footer, HeaderBar, PageShell } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { getSettings } from "@/lib/current-settings";

export const dynamic = "force-dynamic";

function SectionHead({ title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-6 max-w-2xl">
      <h2 className="hex-title text-2xl md:text-3xl">{title}</h2>
      {sub && <p className="mt-2 text-dust">{sub}</p>}
    </div>
  );
}

/**
 * Two interlocking rings, after the linked pair in the Dua mark: the page's
 * one piece of decoration.
 */
function Rings() {
  return (
    <svg viewBox="0 0 420 300" aria-hidden className="h-auto w-full max-w-md" fill="none">
      <defs>
        <linearGradient id="ring-a" gradientUnits="userSpaceOnUse" x1="24" y1="52" x2="256" y2="240">
          <stop offset="0" stopColor="#7B2DFF" />
          <stop offset="1" stopColor="#1677D5" />
        </linearGradient>
        <linearGradient id="ring-b" x1="0.2" y1="1" x2="0.8" y2="0">
          <stop offset="0" stopColor="#0B86C7" />
          <stop offset="1" stopColor="#00D9AA" />
        </linearGradient>
      </defs>
      <rect x="24" y="52" width="232" height="196" rx="98" stroke="url(#ring-a)" strokeWidth="44" />
      <rect x="164" y="52" width="232" height="196" rx="98" stroke="url(#ring-b)" strokeWidth="44" />
      {/* The first ring passes back over the second, so the two read as linked. */}
      <path d="M 238.3 93.8 A 98 98 0 0 0 166.5 52.4" stroke="url(#ring-a)" strokeWidth="44" />
    </svg>
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

  const facts = [
    { label: "When", value: EVENT.dates },
    { label: "Where", value: EVENT.format },
    { label: "Prizes", value: EVENT.prizes },
    {
      label: "Teams",
      value: EVENT.maxTeamSize === 1 ? "Solo entries" : `Solo, or up to ${EVENT.maxTeamSize} people`,
    },
  ].filter((f) => f.value);

  return (
    <>
      <HeaderBar
        rightSlot={
          <>
            <Link href="/mentor" className="pill whitespace-nowrap hover:border-accent hover:text-accent">
              Become a mentor
            </Link>
            <Link href="/register" className="pill-accent">
              Register
            </Link>
          </>
        }
      />

      {/* ---------- HERO ---------- */}
      <section className="border-b border-line bg-ink-2">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-14 md:grid-cols-[1.25fr_1fr] md:py-20">
          <div>
            <h1 className="hex-title text-5xl md:text-6xl">{EVENT.name}</h1>
            {EVENT.tagline && <p className="mt-4 max-w-xl text-xl text-dust">{EVENT.tagline}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href={hero.primary.href} className="btn-accent h-12 px-7 text-base">
                {hero.primary.label}
              </Link>
              <span className="text-sm text-dust">{hero.note}</span>
            </div>
            <p className="mt-8 text-sm text-dust">Hosted by {EVENT.host.name}</p>
          </div>
          <div className="hidden justify-self-end md:block">
            <Rings />
          </div>
        </div>

        {facts.length > 0 && (
          <dl className="mx-auto grid max-w-5xl grid-cols-2 border-t border-line px-5 md:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="py-5 pr-4">
                <dt className="text-sm text-dust">{f.label}</dt>
                <dd className="mt-0.5 font-display text-lg font-semibold text-bone">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <PageShell maxWidth="max-w-5xl">
        {/* ---------- ABOUT THE EVENT ---------- */}
        {INTRO.length > 0 && (
          <section className="py-10">
            <SectionHead title={EVENT.home.introTitle || EVENT.name} />
            <div className="max-w-2xl space-y-4">
              {INTRO.map((para, i) => (
                <p key={i} className={i === 0 ? "text-lg leading-relaxed text-bone" : "leading-relaxed text-dust"}>
                  {para}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* ---------- HIGHLIGHTS ---------- */}
        {PILLARS.length > 0 && (
          <section className="py-10">
            <SectionHead title={EVENT.home.pillarsTitle} sub={EVENT.home.pillarsSubtitle || undefined} />
            <div className="grid items-start gap-x-10 gap-y-6 md:grid-cols-3">
              {PILLARS.map((p) => (
                <details key={p.title} className="group border-t-2 border-bone pt-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="cursor-pointer list-none">
                    <h3 className="font-display text-xl font-semibold text-bone">{p.title}</h3>
                    <p className="mt-1.5 text-dust">{p.text}</p>
                    {p.example && (
                      <span className="mt-3 inline-block text-sm font-bold text-accent">
                        <span className="group-open:hidden">Show an example</span>
                        <span className="hidden group-open:inline">Hide the example</span>
                      </span>
                    )}
                  </summary>
                  {p.example && <p className="mt-3 text-sm leading-relaxed text-bone">{p.example}</p>}
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ---------- TRACKS ---------- */}
        {TRACKS.length > 0 && (
          <section className="py-10">
            <SectionHead title="Challenge tracks" />
            <div className="card divide-y divide-line p-0">
              {TRACKS.map((t) => (
                <details key={t} className="group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                    <span className="font-bold text-bone">{t}</span>
                    {TRACK_EXAMPLES[t] && (
                      <span className="text-sm text-accent">
                        <span className="group-open:hidden">Example</span>
                        <span className="hidden group-open:inline">Close</span>
                      </span>
                    )}
                  </summary>
                  {TRACK_EXAMPLES[t] && <p className="px-5 pb-4 text-sm leading-relaxed text-dust">{TRACK_EXAMPLES[t]}</p>}
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="py-10">
          <SectionHead title="How it works" />
          <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <div className="font-display text-sm font-semibold text-accent">Step {i + 1}</div>
                <h3 className="mt-1 font-display text-lg font-semibold text-bone">{s.t}</h3>
                <p className="mt-1 text-sm text-dust">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- FAQ ---------- */}
        {FAQ.length > 0 && (
          <section className="py-10">
            <SectionHead title="Questions" />
            <div className="card max-w-3xl divide-y divide-line p-0">
              {FAQ.map((f) => (
                <details key={f.q} className="group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-bold text-bone">
                    {f.q}
                    <span aria-hidden className="text-accent transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-4 text-dust">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ---------- CLOSING ---------- */}
        <section className="my-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-accent/10 px-6 py-6">
          <p className="font-display text-xl font-semibold text-bone">{EVENT.tagline || EVENT.name}</p>
          <Link href={hero.primary.href} className="btn-accent">
            {hero.primary.label}
          </Link>
        </section>
      </PageShell>

      <Footer />
    </>
  );
}
