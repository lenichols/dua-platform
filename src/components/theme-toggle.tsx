"use client";

import { useSyncExternalStore } from "react";

const THEME_EVENT = "dua-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The server has no DOM; light is the default and matches the inline script. */
function isLight() {
  return document.documentElement.classList.contains("light");
}

export function ThemeToggle() {
  const light = useSyncExternalStore(subscribe, isLight, () => true);

  function toggle() {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("dua-theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      className="pill hover:border-accent hover:text-accent"
    >
      {light ? "Dark mode" : "Light mode"}
    </button>
  );
}
