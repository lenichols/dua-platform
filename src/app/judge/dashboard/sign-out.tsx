"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return (
    <button onClick={signOut} className="pill hover:border-blood hover:text-blood">
      Sign Out
    </button>
  );
}
