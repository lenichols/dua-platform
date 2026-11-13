import Link from "next/link";
import { ReactNode } from "react";
import { MobileMenu } from "./mobile-menu";
import { ShareButton } from "./share-button";
import { ThemeToggle } from "./theme-toggle";
import { DuaMark } from "./dua-mark";
import { getSettings } from "@/lib/current-settings";
import { PLATFORM } from "@/lib/site";

/** The event's own logo if one is set, otherwise the Dua mark. */
function EventLogo({ url, size, className }: { url: string; size: number; className: string }) {
  if (!url) return <DuaMark size={size} className={className} />;
  return (
    // A plain <img>: the logo can be hosted anywhere, and may be an SVG.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={`${className} object-contain`} />
  );
}

export async function Wordmark({
  className = "",
  serif = true,
}: {
  className?: string;
  serif?: boolean;
}) {
  const EVENT = await getSettings();
  // Draw EVENT.accentWord in the accent colour, wherever it sits in the name.
  const accent: string = EVENT.accentWord;
  const at = accent ? EVENT.name.indexOf(accent) : -1;
  return (
    <span
      className={`leading-none text-bone ${
        serif
          ? "font-serif font-medium tracking-tight"
          : "font-display tracking-[0.06em]"
      } ${className}`}
    >
      {at < 0 ? (
        EVENT.name
      ) : (
        <>
          {EVENT.name.slice(0, at)}
          <span className="text-crimson">{accent}</span>
          {EVENT.name.slice(at + accent.length)}
        </>
      )}
    </span>
  );
}

export async function Footer() {
  const EVENT = await getSettings();
  return (
    <footer className="mt-16 border-t border-line bg-ink/60">
      <div className="flex w-full flex-col gap-5 px-5 py-8 text-sm text-dust md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <EventLogo url={EVENT.theme.logoUrl} className="h-7 w-7 text-bone" size={28} />
          <div>
            <div className="font-serif text-bone">{EVENT.name}</div>
            <div className="text-xs">
              Hosted by{" "}
              <a
                href={EVENT.host.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-crimson"
              >
                {EVENT.host.name}
              </a>{" "}
              · Powered by{" "}
              <a
                href={PLATFORM.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-crimson"
              >
                {PLATFORM.name}
              </a>
            </div>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.7rem] uppercase tracking-wider">
          <Link href="/register" className="transition hover:text-crimson">
            Register
          </Link>
          <Link href="/mentor" className="transition hover:text-crimson">
            Become a Mentor
          </Link>
          <a
            href={EVENT.host.url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-crimson"
          >
            {EVENT.host.name}
          </a>
        </nav>
      </div>
    </footer>
  );
}

export async function HeaderBar({ rightSlot }: { rightSlot?: ReactNode }) {
  const EVENT = await getSettings();
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-line bg-ink/80 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3">
      <Link
        href="/"
        className="group flex items-center gap-2.5 text-bone transition hover:opacity-90 sm:gap-3"
        aria-label={`${EVENT.name} — Home`}
      >
        <EventLogo
          url={EVENT.theme.logoUrl}
          size={36}
          className="h-8 w-8 transition group-hover:scale-105 md:h-9 md:w-9"
        />
        <Wordmark className="whitespace-nowrap text-lg sm:text-xl md:text-2xl" />
      </Link>
      {/* Desktop / tablet: inline nav */}
      <nav className="hidden items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider sm:flex">
        <ShareButton />
        <ThemeToggle />
        {rightSlot}
      </nav>
      {/* Phones: everything collapses behind a hamburger */}
      <MobileMenu>
        <ShareButton />
        <ThemeToggle />
        {rightSlot}
      </MobileMenu>
    </header>
  );
}

// Plain layout pieces live in page-parts.tsx so client components can use
// them; this file reads the event from the database and is server-only.
export { Breadcrumbs, PageShell, SectionTitle } from "./page-parts";
