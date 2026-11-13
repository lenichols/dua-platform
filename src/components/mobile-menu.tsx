"use client";

import { ReactNode, useState } from "react";

// Mobile-only hamburger that collapses the header nav. Rendered inside the
// sticky <header>, so the dropdown panel positions against it (sticky
// elements are positioned ancestors).
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-ink-4 text-lg text-bone transition hover:border-crimson hover:text-crimson"
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <nav
          className="absolute left-0 right-0 top-full flex flex-col items-start gap-2.5 border-b border-line bg-ink/95 px-5 py-4 text-[0.7rem] font-semibold uppercase tracking-wider backdrop-blur animate-fade-up"
          onClick={(e) => {
            // Close after navigating; keep open for in-place buttons like
            // the theme toggle and share.
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </nav>
      )}
    </div>
  );
}
