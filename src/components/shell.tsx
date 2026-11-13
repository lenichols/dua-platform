import Link from "next/link";
import { ReactNode } from "react";
import { MobileMenu } from "./mobile-menu";
import { ShareButton } from "./share-button";
import { ThemeToggle } from "./theme-toggle";
import { DuaMark } from "./dua-mark";
import { getSettings } from "@/lib/current-settings";
import { demoMode } from "@/lib/demo";
import { PLATFORM } from "@/lib/site";

/** The event's own logo if one is set, otherwise the Dua mark. */
function EventLogo({
  url,
  size,
  className,
}: {
  url: string;
  size: number;
  className: string;
}) {
  if (!url) return <DuaMark size={size} className={className} />;
  return (
    // A plain <img>: the logo can be hosted anywhere, and may be an SVG.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className={`${className} object-contain`}
    />
  );
}

export async function Wordmark({
  className = "",
}: {
  className?: string;
  serif?: boolean;
}) {
  const EVENT = await getSettings();
  // If the organizer picked a word to highlight, draw it in the accent colour.
  const accent: string = EVENT.accentWord;
  const at = accent ? EVENT.name.indexOf(accent) : -1;
  return (
    <span
      className={`font-display font-semibold leading-none tracking-tight text-bone ${className}`}
    >
      {at < 0 ? (
        EVENT.name
      ) : (
        <>
          {EVENT.name.slice(0, at)}
          <span className="text-accent">{accent}</span>
          {EVENT.name.slice(at + accent.length)}
        </>
      )}
    </span>
  );
}

export async function Footer() {
  const EVENT = await getSettings();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="flex w-full flex-col gap-5 px-5 py-8 text-sm text-dust md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <EventLogo
            url={EVENT.theme.logoUrl}
            className="h-7 w-7 text-bone"
            size={28}
          />
          <div>
            <div className="font-display font-semibold text-bone">
              {EVENT.name}
            </div>
            <div className="text-xs">
              Hosted by{" "}
              <a
                href={EVENT.host.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-accent"
              >
                {EVENT.host.name}
              </a>{" "}
              · Powered by{" "}
              <a
                href={PLATFORM.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-accent"
              >
                {PLATFORM.name}
              </a>
            </div>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {EVENT.features.registration && (
            <Link href="/register" className="transition hover:text-accent">
              Register
            </Link>
          )}
          {EVENT.features.mentors && (
            <Link href="/mentor" className="transition hover:text-accent">
              Become a mentor
            </Link>
          )}
          <a
            href={EVENT.host.url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-accent"
          >
            {EVENT.host.name}
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** A link to Dua's source code. Organizers can turn it off in the Event tab. */
function SourceLink() {
  return (
    <a
      href={PLATFORM.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pill whitespace-nowrap hover:border-accent hover:text-accent"
      data-source-link
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      GitHub
    </a>
  );
}

export async function HeaderBar({ rightSlot }: { rightSlot?: ReactNode }) {
  const EVENT = await getSettings();
  return (
    <>
      {demoMode() && (
        <div
          className="bg-accent/10 px-4 py-1.5 text-center text-xs text-bone"
          data-demo-banner
        >
          This is a demo with sample data. Sign in with the sample logins on the{" "}
          <Link href="/judge" className="font-bold underline">
            judge
          </Link>{" "}
          and{" "}
          <Link href="/admin" className="font-bold underline">
            admin
          </Link>{" "}
          pages. Anything you change is reset regularly.
        </div>
      )}
      <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-line bg-ink-2/90 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-bone transition hover:opacity-90 sm:gap-3"
          aria-label={`${EVENT.name} — Home`}
        >
          <EventLogo
            url={EVENT.theme.logoUrl}
            size={36}
            className="h-8 w-8 md:h-9 md:w-9"
          />
          <Wordmark className="whitespace-nowrap text-base sm:text-lg md:text-xl" />
        </Link>
        {/* Desktop / tablet: inline nav */}
        <nav className="hidden items-center gap-2 text-sm sm:flex">
          <ShareButton />
          {EVENT.theme.showSourceLink && <SourceLink />}
          <ThemeToggle />
          {rightSlot}
        </nav>
        {/* Phones: everything collapses behind a hamburger */}
        <MobileMenu>
          <ShareButton />
          {EVENT.theme.showSourceLink && <SourceLink />}
          <ThemeToggle />
          {rightSlot}
        </MobileMenu>
      </header>
    </>
  );
}

// Plain layout pieces live in page-parts.tsx so client components can use
// them; this file reads the event from the database and is server-only.
export { Breadcrumbs, PageShell, SectionTitle } from "./page-parts";
