"use client";

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (e) {
        // User cancelled the share sheet — do nothing.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Anything else: fall through to the clipboard fallback.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share this page"
      title="Share this page"
      className="pill hover:border-crimson hover:text-crimson"
    >
      {copied ? "✓ Copied" : "↗ Share"}
    </button>
  );
}
