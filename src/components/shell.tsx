import Link from "next/link";
import { ReactNode } from "react";
import { MobileMenu } from "./mobile-menu";
import { ShareButton } from "./share-button";
import { ThemeToggle } from "./theme-toggle";
import { DuaMark } from "./dua-mark";
import { EVENT, PLATFORM } from "@/lib/site";

export function Wordmark({
  className = "",
  serif = true,
}: {
  className?: string;
  serif?: boolean;
}) {
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

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-ink/60">
      <div className="flex w-full flex-col gap-5 px-5 py-8 text-sm text-dust md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <DuaMark size={28} className="h-7 w-7 text-bone" />
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

export function HeaderBar({ rightSlot }: { rightSlot?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-line bg-ink/80 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3">
      <Link
        href="/"
        className="group flex items-center gap-2.5 text-bone transition hover:opacity-90 sm:gap-3"
        aria-label={`${EVENT.name} — Home`}
      >
        <DuaMark
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

export function PageShell({
  children,
  maxWidth = "max-w-5xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className={`mx-auto w-full ${maxWidth} px-5 py-8 md:py-12`}>
      {children}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-dust"
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-line">›</span>}
            {it.href && !isLast ? (
              <Link
                href={it.href}
                className="transition hover:text-crimson"
              >
                {it.label}
              </Link>
            ) : (
              <span className={isLast ? "text-bone" : ""}>{it.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-6 animate-fade-up ${center ? "text-center" : ""}`}>
      {eyebrow && (
        <div className="mb-2 font-cond text-[0.7rem] uppercase tracking-[0.3em] text-crimson">
          {eyebrow}
        </div>
      )}
      <h1 className="hex-title text-4xl md:text-5xl">{title}</h1>
      {subtitle && (
        <p className={`mt-3 max-w-2xl text-dust ${center ? "mx-auto" : ""}`}>
          {subtitle}
        </p>
      )}
      <div
        className={`mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70 ${
          center ? "mx-auto" : ""
        }`}
      />
    </div>
  );
}
