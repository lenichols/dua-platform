"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SampleLogins } from "@/components/sample-logins";
import type { SampleLogin } from "@/lib/demo";
import { signInJudge } from "./actions";

export function JudgeSignIn({ samples = [] }: { samples?: SampleLogin[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("signing");
    setErrMsg("");
    const result = await signInJudge(email.trim().toLowerCase(), password);
    if (!result.ok) {
      setStatus("err");
      setErrMsg(result.error);
      return;
    }
    router.push("/judge/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="judge-email">
          Email address
        </label>
        <input
          id="judge-email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input mt-1"
          placeholder="you@example.org"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="judge-password">
          Password
        </label>
        <input
          id="judge-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input mt-1"
        />
        <p className="mt-1.5 text-xs text-dust">
          The organizers send this to judges and mentors directly.
        </p>
      </div>
      {status === "err" && (
        <div className="rounded-lg border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
          {errMsg}
        </div>
      )}
      <button className="btn-accent w-full" disabled={status === "signing"}>
        {status === "signing" ? "Signing in…" : "Sign in"}
      </button>
      <SampleLogins
        logins={samples}
        onPick={(l) => {
          setEmail(l.email);
          setPassword(l.password);
          setStatus("idle");
        }}
      />
    </form>
  );
}
