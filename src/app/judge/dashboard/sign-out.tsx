"use client";

import { useRouter } from "next/navigation";
import { signOutJudge } from "../actions";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await signOutJudge();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="pill hover:border-blood hover:text-blood">
      Sign Out
    </button>
  );
}
