"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function JudgeSignIn({ unauthorized }: { unauthorized?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("signing");
    setErrMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setStatus("err");
      setErrMsg(
        error.message === "Invalid login credentials"
          ? "Wrong email or password. Check with the organizers."
          : error.message,
      );
      return;
    }
    router.push("/judge/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {unauthorized && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
          You're signed in but not on the judges roster. Contact the organizers or
          use a different email.
        </div>
      )}
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
      <button className="btn-crimson w-full" disabled={status === "signing"}>
        {status === "signing" ? "Signing in…" : "→ Sign In"}
      </button>
      <p className="text-[0.7rem] text-dust">
        Don't have a password? Ask the organizers — they'll share the shared
        judges password with you.
      </p>
    </form>
  );
}
