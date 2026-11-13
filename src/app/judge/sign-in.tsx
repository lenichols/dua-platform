"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInJudge } from "./actions";

export function JudgeSignIn() {
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
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="field-label">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input mt-1"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="field-label">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input mt-1"
          placeholder="Provided by the organizers"
        />
      </div>
      {status === "err" && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
          {errMsg}
        </div>
      )}
      <button className="btn-accent w-full" disabled={status === "signing"}>
        {status === "signing" ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-[0.7rem] text-dust">
        Don't have a password? Ask the organizers — they'll share the shared
        judges password with you.
      </p>
    </form>
  );
}
