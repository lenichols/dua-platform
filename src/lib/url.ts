/**
 * Normalize a user-supplied URL into something safe to use as an `href`.
 * Returns `null` if the input is empty or clearly not a link.
 *
 * Submitted links don't always include a protocol, so a bare `example.com`
 * would otherwise be resolved as a relative path by the browser.
 */
export function safeHref(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Obvious non-URL placeholders
  if (trimmed === "-" || trimmed === "#" || trimmed === "n/a" || trimmed.toLowerCase() === "none") {
    return null;
  }

  // Already has a scheme we trust
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;

  // Strip any other stray scheme (javascript:, file:, etc.) — those shouldn't
  // be linkable from user input.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  // Otherwise assume the user meant https and the protocol was dropped.
  return `https://${trimmed.replace(/^\/+/, "")}`;
}
