"use client";

import { useActionState, useState } from "react";
import { SampleLogins } from "@/components/sample-logins";
import type { SampleLogin } from "@/lib/demo";
import { signInAdmin } from "./actions";

export function AdminSignIn({ samples = [] }: { samples?: SampleLogin[] }) {
  const [state, action, pending] = useActionState(signInAdmin, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          name="email"
          autoComplete="username"
          className="field-input mt-1"
          placeholder="you@example.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </div>
      <div>
        <label className="field-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="field-input mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {state && "error" in state && state.error && (
        <div className="rounded-lg border border-blood/60 bg-blood/10 px-3 py-2 text-sm text-blood">
          {state.error}
        </div>
      )}
      <button className="btn-accent w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-dust">
        Setting up for the first time? Leave the email blank and enter the{" "}
        <code>ADMIN_PASSWORD</code>
        {" "}from your server&apos;s settings.
      </p>
      <SampleLogins
        logins={samples}
        onPick={(l) => {
          setEmail(l.email);
          setPassword(l.password);
        }}
      />
    </form>
  );
}
