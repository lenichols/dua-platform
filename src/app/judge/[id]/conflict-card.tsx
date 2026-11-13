"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declareConflict, withdrawConflict } from "../actions";

export function ConflictCard({
  submissionId,
  recusal,
}: {
  submissionId: string;
  recusal: { reason: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => ReturnType<typeof withdrawConflict>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (recusal) {
    return (
      <div className="card h-fit border-l-4 border-l-blood">
        <div className="pill mb-2 border-blood/50 text-blood">Conflict declared</div>
        <p className="text-sm text-dust">
          You&apos;ve recused yourself from this project. It&apos;s out of your
          queue and progress count, and the organizers can see the
          declaration. The rest of the panel scores it.
        </p>
        {recusal.reason && (
          <p className="mt-2 text-xs text-bone/80">
            <span className="text-dust">Your note: </span>
            {recusal.reason}
          </p>
        )}
        <button
          type="button"
          onClick={() => run(() => withdrawConflict(submissionId))}
          disabled={pending}
          className="pill mt-3 hover:border-crimson hover:text-crimson"
        >
          {pending ? "Withdrawing…" : "Withdraw — I can judge this after all"}
        </button>
        {err && <p className="mt-2 text-xs text-blood">{err}</p>}
      </div>
    );
  }

  return (
    <div className="card h-fit">
      <div className="field-label">Conflict of interest?</div>
      <p className="mt-1 text-xs text-dust">
        If you advise, employ, fund, or are related to anyone on this team —
        or have a financial interest in the solution — recuse yourself. Any
        score you&apos;ve given it is removed. Tell the organizers too.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pill mt-3 hover:border-blood hover:text-blood"
        >
          Declare a conflict
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="field-label" htmlFor="conflict-reason">
            What&apos;s the conflict? (optional, organizers only)
          </label>
          <input
            id="conflict-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="field-input"
            placeholder="e.g. I mentored this team in September"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => run(() => declareConflict(submissionId, reason))}
              disabled={pending}
              className="btn-danger text-xs"
            >
              {pending ? "Saving…" : "Recuse me from this project"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="btn text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-blood">{err}</p>}
    </div>
  );
}
