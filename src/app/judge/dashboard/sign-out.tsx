"use client";

import { signOutJudge } from "../actions";

export function SignOutButton() {
  async function signOut() {
    await signOutJudge();
    window.location.href = "/";
  }
  return (
    <button onClick={signOut} className="pill hover:border-blood hover:text-blood">
      Sign Out
    </button>
  );
}
