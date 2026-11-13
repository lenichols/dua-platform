// Layout pieces with no data of their own. Safe to use from client
// components.

import Link from "next/link";
import { ReactNode } from "react";

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
