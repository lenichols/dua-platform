"use client";

import type { SampleLogin } from "@/lib/demo";

/**
 * Sample accounts offered on a sign-in page in demo mode. Choosing one fills
 * the form; the visitor still presses the sign-in button themselves.
 */
export function SampleLogins({
  logins,
  onPick,
}: {
  logins: SampleLogin[];
  onPick: (login: SampleLogin) => void;
}) {
  if (logins.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-line p-4" data-sample-logins>
      <p className="text-sm font-bold text-bone">Sample logins</p>
      <p className="mt-0.5 text-xs text-dust">
        This is a demo, so these are public. Pick one to fill in the form.
      </p>
      <ul className="mt-3 space-y-2">
        {logins.map((l) => (
          <li key={l.email}>
            <button
              type="button"
              onClick={() => onPick(l)}
              data-sample={l.label.toLowerCase()}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-ink-4 px-3 py-2 text-left transition-colors hover:border-accent"
            >
              <span>
                <span className="block text-sm font-bold text-bone">{l.label}</span>
                <span className="block text-xs text-dust">{l.can}</span>
              </span>
              <span className="text-right text-xs text-dust">
                <span className="block">{l.email}</span>
                <span className="block font-bold text-bone">{l.password}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
