"use client";

import { useActionState } from "react";
import { signInAdmin } from "./actions";

export function AdminSignIn() {
  const [state, action, pending] = useActionState(signInAdmin, null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="field-label">Email</label>
        <input
          type="email"
          name="email"
          autoComplete="username"
          className="field-input mt-1"
          placeholder="you@example.org"
          autoFocus
        />
      </div>
      <div>
        <label className="field-label">Password</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="field-input mt-1"
        />
      </div>
      {state && "error" in state && state.error && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {state.error}
        </div>
      )}
      <button className="btn-crimson w-full" disabled={pending}>
        {pending ? "Signing in…" : "🔓 Unlock Admin"}
      </button>
      <p className="text-[0.7rem] text-dust">
        Using the original shared admin password? Leave the email blank and
        enter it below — that still works and signs you in as an owner.
      </p>
    </form>
  );
}
