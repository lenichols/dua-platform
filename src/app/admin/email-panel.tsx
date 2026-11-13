"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  previewAudience,
  sendCampaign,
  sendCampaignTest,
  uploadCampaignImage,
} from "./actions";
import {
  AUDIENCE_LABELS,
  AUDIENCES,
  isAdminAudience,
  type Audience,
} from "@/lib/campaign-audiences";

export type CampaignRow = {
  id: string;
  subject: string;
  audience: Audience;
  status: "draft" | "sending" | "sent" | "failed";
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  error_detail: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
};

/**
 * Toolbar commands. document.execCommand is formally deprecated but is still
 * implemented everywhere and is the only zero-dependency way to get a real
 * WYSIWYG. The alternative (Tiptap/ProseMirror) is ~20 packages for an
 * internal composer that only needs to emit six tags — email HTML has to stay
 * simple regardless, so the ceiling a richer editor buys is unusable here.
 */
const COMMANDS: { label: string; title: string; run: () => void; className?: string }[] = [
  { label: "B", title: "Bold", run: () => document.execCommand("bold"), className: "font-bold" },
  { label: "I", title: "Italic", run: () => document.execCommand("italic"), className: "italic" },
  { label: "U", title: "Underline", run: () => document.execCommand("underline"), className: "underline" },
  { label: "H2", title: "Heading", run: () => document.execCommand("formatBlock", false, "h2") },
  { label: "H3", title: "Subheading", run: () => document.execCommand("formatBlock", false, "h3") },
  { label: "¶", title: "Normal text", run: () => document.execCommand("formatBlock", false, "p") },
  { label: "• List", title: "Bulleted list", run: () => document.execCommand("insertUnorderedList") },
  { label: "1. List", title: "Numbered list", run: () => document.execCommand("insertOrderedList") },
  { label: "❝", title: "Quote", run: () => document.execCommand("formatBlock", false, "blockquote") },
  { label: "⎯", title: "Divider", run: () => document.execCommand("insertHorizontalRule") },
];

export function EmailPanel({
  campaigns,
  loadError,
  defaultTestEmail,
  readOnly,
}: {
  campaigns: CampaignRow[];
  loadError: string | null;
  defaultTestEmail: string;
  readOnly: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // execCommand acts on the live selection, which is lost the moment focus
  // moves to the file picker — so the caret position is saved on the way out
  // and restored before inserting.
  const savedRange = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [confirm, setConfirm] = useState("");
  const [testEmail, setTestEmail] = useState(defaultTestEmail);

  const [counts, setCounts] = useState<{ subscribed: number; unsubscribed: number } | null>(null);
  const [testState, setTestState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sendState, setSendState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testPending, startTest] = useTransition();
  const [sendPending, startSend] = useTransition();

  // Recipient count for the selected audience — the blast size should never be
  // a surprise at the moment you press send.
  useEffect(() => {
    if (readOnly) return;
    let stale = false;
    previewAudience(audience).then((r) => {
      if (stale) return;
      setCounts(r.ok ? { subscribed: r.subscribed, unsubscribed: r.unsubscribed } : null);
    });
    return () => {
      stale = true;
    };
  }, [audience, readOnly]);

  function bodyHtml() {
    return editorRef.current?.innerHTML ?? "";
  }

  function buildForm() {
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("bodyHtml", bodyHtml());
    fd.set("audience", audience);
    return fd;
  }

  function onTest() {
    setTestState(null);
    const fd = buildForm();
    fd.set("testEmail", testEmail);
    startTest(async () => {
      const r = await sendCampaignTest(null, fd);
      setTestState(
        r.ok
          ? { ok: true, msg: `Test sent to ${r.to}. Check how it renders before sending for real.` }
          : { ok: false, msg: r.error },
      );
    });
  }

  function onSend() {
    setSendState(null);
    const fd = buildForm();
    fd.set("confirm", confirm);
    startSend(async () => {
      const r = await sendCampaign(null, fd);
      if (!r.ok) {
        setSendState({ ok: false, msg: r.error });
        return;
      }
      setSendState({
        ok: true,
        msg:
          `Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}` +
          (r.failed > 0 ? ` · ${r.failed} failed: ${r.errors.join(" | ")}` : "."),
      });
      setConfirm("");
    });
  }

  // Paste as plain text. Pasting from Word or Google Docs otherwise drags in
  // font tags and inline styles that the sanitizer strips anyway — better to
  // drop them at the door than to let the editor show formatting that silently
  // disappears from the sent email.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  function saveCaret() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function insertAtCaret(html: string) {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("insertHTML", false, html);
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after an error
    if (!file) return;

    setUploadErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadCampaignImage(fd);
    setUploading(false);

    if (!r.ok) {
      setUploadErr(r.error);
      return;
    }
    const alt = file.name.replace(/\.[^.]+$/, "");
    insertAtCaret(
      `<img src="${r.url}" alt="${alt.replace(/"/g, "")}" /><p><br /></p>`,
    );
  }

  function addLink() {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    document.execCommand("createLink", false, url);
  }

  if (readOnly) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="field-label mb-2">Email Blasts</div>
          <p className="text-sm text-dust">
            Sending email is a write action, so it's hidden for read-only
            accounts. The history below shows what's already gone out.
          </p>
        </div>
        <CampaignHistory campaigns={campaigns} loadError={loadError} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="pill-crimson">Compose</div>
          <span className="text-[0.65rem] uppercase tracking-wider text-dust">
            Sent via Resend
          </span>
        </div>

        <div>
          <label className="field-label" htmlFor="campaign-subject">
            Subject
          </label>
          <input
            id="campaign-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="field-input mt-1"
            placeholder="Submissions open Friday — here's what you need"
          />
        </div>

        <div>
          <span className="field-label">Message</span>
          <div className="mt-1 overflow-hidden rounded-md border border-line">
            <div className="flex flex-wrap gap-1 border-b border-line bg-ink-4 p-2">
              {COMMANDS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.title}
                  aria-label={c.title}
                  onMouseDown={(e) => {
                    // Keep the caret in the editor — losing selection on
                    // mousedown makes execCommand a no-op.
                    e.preventDefault();
                    c.run();
                  }}
                  className={`rounded border border-line bg-ink-5 px-2.5 py-1 text-xs text-bone transition hover:border-crimson hover:text-crimson ${c.className ?? ""}`}
                >
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                title="Insert link"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addLink();
                }}
                className="rounded border border-line bg-ink-5 px-2.5 py-1 text-xs text-bone transition hover:border-crimson hover:text-crimson"
              >
                🔗 Link
              </button>
              <button
                type="button"
                title="Insert image"
                disabled={uploading}
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveCaret();
                  fileRef.current?.click();
                }}
                className="rounded border border-line bg-ink-5 px-2.5 py-1 text-xs text-bone transition hover:border-crimson hover:text-crimson disabled:opacity-40"
              >
                {uploading ? "Uploading…" : "🖼 Image"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={onPickImage}
                className="hidden"
              />
              <button
                type="button"
                title="Remove formatting"
                onMouseDown={(e) => {
                  e.preventDefault();
                  document.execCommand("removeFormat");
                }}
                className="rounded border border-line bg-ink-5 px-2.5 py-1 text-xs text-dust transition hover:border-blood hover:text-blood"
              >
                Clear
              </button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Message body"
              onPaste={onPaste}
              className="campaign-editor min-h-[240px] bg-ink-5 px-4 py-3 text-sm leading-relaxed text-bone outline-none focus:ring-1 focus:ring-crimson"
            />
          </div>
          {uploadErr && (
            <div
              role="alert"
              className="mt-2 rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood"
            >
              {uploadErr}
            </div>
          )}
          <p className="mt-1.5 text-[0.7rem] text-dust">
            Formatting is limited to what renders reliably in email clients.
            Pasted text comes in unstyled on purpose. Images: PNG, JPEG, or GIF
            up to 5 MB — they&apos;re hosted publicly so inboxes can load them.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="campaign-audience">
              Audience
            </label>
            <select
              id="campaign-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="field-input mt-1"
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </option>
              ))}
            </select>
<p className="mt-1.5 text-[0.7rem] text-dust">
              {!counts
                ? "Counting…"
                : isAdminAudience(audience)
                  ? `${counts.subscribed} admin${counts.subscribed === 1 ? "" : "s"} — internal, no unsubscribe link`
                  : `${counts.subscribed} subscribed recipient${counts.subscribed === 1 ? "" : "s"}` +
                    (counts.unsubscribed > 0
                      ? ` · ${counts.unsubscribed} opted out and will be skipped`
                      : "")}
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="campaign-test">
              Send a test first
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="campaign-test"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="field-input"
                placeholder="you@example.com"
              />
              <button
                type="button"
                onClick={onTest}
                disabled={testPending}
                className="btn shrink-0"
              >
                {testPending ? "Sending…" : "Test"}
              </button>
            </div>
            <p className="mt-1.5 text-[0.7rem] text-dust">
              Goes to one address, isn't recorded, and skips the unsubscribe link.
            </p>
          </div>
        </div>

        {testState && (
          <div
            role="status"
            className={`rounded-md border px-3 py-2 text-xs ${
              testState.ok
                ? "border-jade/60 bg-jade/10 text-jade"
                : "border-blood/60 bg-blood/10 text-blood"
            }`}
          >
            {testState.ok ? "✓ " : ""}
            {testState.msg}
          </div>
        )}
      </div>

      <div
        className={`card space-y-4 border-l-4 ${
          isAdminAudience(audience) ? "border-l-line" : "border-l-blood"
        }`}
      >
        <div>
          <div className="field-label">Send for real</div>
          <p className="mt-1 text-xs text-dust">
            This goes to{" "}
            <strong className="text-bone">
              {counts ? counts.subscribed : "…"}{" "}
              {isAdminAudience(audience) ? "admins" : "people"}
            </strong>{" "}
            and cannot be recalled.
            {isAdminAudience(audience)
              ? " Internal audience — a safe way to trial a draft on your own team."
              : " Send yourself a test first."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="field-label" htmlFor="campaign-confirm">
              Type SEND to confirm
            </label>
            <input
              id="campaign-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field-input mt-1"
              placeholder="SEND"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={sendPending || confirm.trim().toUpperCase() !== "SEND"}
            className={`disabled:opacity-40 ${
              isAdminAudience(audience) ? "btn-crimson" : "btn-danger"
            }`}
          >
            {sendPending
              ? "Sending…"
              : isAdminAudience(audience)
                ? "Send to the team"
                : "📣 Send to all"}
          </button>
        </div>
        {sendState && (
          <div
            role="status"
            className={`rounded-md border px-3 py-2 text-xs ${
              sendState.ok
                ? "border-jade/60 bg-jade/10 text-jade"
                : "border-blood/60 bg-blood/10 text-blood"
            }`}
          >
            {sendState.ok ? "✓ " : ""}
            {sendState.msg}
          </div>
        )}
      </div>

      <CampaignHistory campaigns={campaigns} loadError={loadError} />
    </div>
  );
}

function CampaignHistory({
  campaigns,
  loadError,
}: {
  campaigns: CampaignRow[];
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <div className="card border-l-4 border-l-blood">
        <div className="field-label mb-2">History unavailable</div>
        <p className="text-sm text-blood">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-line px-4 py-3">
        <span className="field-label !mb-0">Sent ({campaigns.length})</span>
      </div>
      {campaigns.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-dust">
          Nothing sent yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {campaigns.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-bone">{c.subject}</span>
                <span className="text-[0.7rem] text-dust">
                  {c.sent_at
                    ? new Date(c.sent_at).toLocaleString()
                    : new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-dust">
                <span className="pill">{AUDIENCE_LABELS[c.audience]}</span>
                <span className={c.failed_count > 0 ? "text-blood" : "text-jade"}>
                  {c.sent_count} sent
                  {c.failed_count > 0 && ` · ${c.failed_count} failed`}
                </span>
                {c.created_by && <span>by {c.created_by}</span>}
              </div>
              {c.error_detail && (
                <p className="mt-1 text-[0.7rem] text-blood">{c.error_detail}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
