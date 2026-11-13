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
      className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-dust"
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-line">›</span>}
            {it.href && !isLast ? (
              <Link
                href={it.href}
                className="transition hover:text-accent"
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
  // `eyebrow` says where you are (a phase, an access level). It's shown as
  // a quiet line above the title, not as decoration.
  return (
    <div className={`mb-6 ${center ? "text-center" : ""}`}>
      {eyebrow && <div className="mb-1.5 text-sm font-bold text-accent">{eyebrow}</div>}
      <h1 className="hex-title text-3xl md:text-4xl">{title}</h1>
      {subtitle && (
        <p className={`mt-3 max-w-2xl text-dust ${center ? "mx-auto" : ""}`}>{subtitle}</p>
      )}
    </div>
  );
}
