"use client";

import { useActionState, useState } from "react";
import { registerParticipant } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import {
  EXPERIENCE_LEVELS,
  HEARD_ABOUT,
  PARTNER_ORGS,
  TRACKS,
} from "@/lib/hackathon";
import { EVENT } from "@/lib/site";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerParticipant, null);
  const [mode, setMode] = useState<"Solo" | "Team">("Solo");
  const [partnerSel, setPartnerSel] = useState<string[]>([]);
  const [partnerOther, setPartnerOther] = useState("");

  const togglePartner = (o: string) =>
    setPartnerSel((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );
  const partnerOrgValue = [...partnerSel, partnerOther.trim()]
    .filter(Boolean)
    .join(", ");

  if (state?.ok) {
    return (
      <div className="card animate-fade-up">
        <div className="pill-crimson mb-4">✓ You&apos;re Registered</div>
        <h2 className="hex-title text-4xl">See You There.</h2>
        <p className="mt-3 text-dust">
          Thanks for registering for {EVENT.name}. We&apos;ll
          email you everything you need before the event — including your link
          to the project submission form.
        </p>
        <p className="mt-4 text-sm text-dust">
          In the meantime, post about it on LinkedIn and tag{" "}
          <a
            href={EVENT.host.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bone underline decoration-crimson/60 hover:text-crimson"
          >
            {EVENT.host.name}
          </a>
          .
        </p>
      </div>
    );
  }

  const fe = state?.ok === false ? state.fieldErrors ?? {} : {};
  const err = (k: string) =>
    fe[k]?.[0] ? <p className="mt-1 text-xs text-blood">{fe[k]![0]}</p> : null;

  return (
    <form action={action} className="space-y-6">
      <fieldset className="card space-y-4">
        <legend className="pill-crimson -mt-2 mb-2">1. About You</legend>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Full Name *</label>
            <input
              name="full_name"
              required
              autoComplete="name"
              className="field-input mt-1"
            />
            {err("full_name")}
          </div>
          <div>
            <label className="field-label">Email Address *</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="field-input mt-1"
            />
            {err("email")}
          </div>
          <div>
            <label className="field-label">Phone Number *</label>
            <input
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              className="field-input mt-1"
            />
            {err("phone")}
            <p className="mt-1 text-xs text-dust">
              Include your country code if outside the US.
            </p>
          </div>
          <div>
            <label className="field-label">Country *</label>
            <select
              name="country"
              required
              defaultValue=""
              autoComplete="country-name"
              className="field-input mt-1"
            >
              <option value="">— Select —</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {err("country")}
          </div>
          <div>
            <label className="field-label">Organization</label>
            <input
              name="organization"
              placeholder="Company, school, or independent"
              autoComplete="organization"
              className="field-input mt-1"
            />
          </div>
          <div>
            <label className="field-label">LinkedIn Profile</label>
            <input
              name="linkedin_url"
              type="url"
              inputMode="url"
              placeholder="https://linkedin.com/in/you"
              className="field-input mt-1"
            />
            {err("linkedin_url")}
          </div>
          <div>
            <label className="field-label">Personal Website</label>
            <input
              name="website_url"
              type="url"
              inputMode="url"
              placeholder="https://your-site.com"
              className="field-input mt-1"
            />
            {err("website_url")}
          </div>
          <p className="text-xs text-dust md:col-span-2">
            Add your LinkedIn <span className="text-dust">and/or</span> a personal
            website so organizers can verify who you are.{" "}
            <span className="text-bone/80">At least one is required.</span>
          </p>
        </div>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="pill-crimson -mt-2 mb-2">2. How You&apos;ll Compete</legend>

        <div className="flex gap-2">
          {(["Solo", "Team"] as const).map((opt) => (
            <label
              key={opt}
              className={`flex-1 cursor-pointer rounded-md border px-4 py-3 text-center font-cond text-sm uppercase tracking-wider transition ${
                mode === opt
                  ? "border-crimson bg-crimson/10 text-crimson"
                  : "border-line bg-ink-4 text-dust hover:border-crimson/60"
              }`}
            >
              <input
                type="radio"
                name="participating_as"
                value={opt}
                checked={mode === opt}
                onChange={() => setMode(opt)}
                className="sr-only"
              />
              {opt}
            </label>
          ))}
        </div>

        {mode === "Team" && (
          <div>
            <label className="field-label">Team Name *</label>
            <input name="team_name" required className="field-input mt-1" />
            {err("team_name")}
            <p className="mt-1 text-xs text-dust">
              Don&apos;t have a final team yet? A working name is fine — you can
              finalize it when you submit your project.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Primary Interest *</label>
            <select
              name="primary_interest"
              required
              defaultValue=""
              className="field-input mt-1"
            >
              <option value="">— Select a track —</option>
              {TRACKS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {err("primary_interest")}
          </div>
          <div>
            <label className="field-label">Experience Level *</label>
            <select
              name="experience_level"
              required
              defaultValue=""
              className="field-input mt-1"
            >
              <option value="">— Select —</option>
              {EXPERIENCE_LEVELS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            {err("experience_level")}
          </div>
        </div>

        <div>
          <label className="field-label">
            Partner Organization{" "}
            <span className="text-dust">(optional · select any that apply)</span>
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PARTNER_ORGS.map((o) => {
              const active = partnerSel.includes(o);
              return (
                <label
                  key={o}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    active
                      ? "border-crimson bg-crimson/10 text-crimson"
                      : "border-line bg-ink-4 text-dust hover:border-crimson/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => togglePartner(o)}
                    className="h-4 w-4 accent-crimson"
                  />
                  {o}
                </label>
              );
            })}
          </div>
          <input
            value={partnerOther}
            onChange={(e) => setPartnerOther(e.target.value)}
            placeholder="Another group? Type to add it"
            className="field-input mt-2"
          />
          <input type="hidden" name="partner_org" value={partnerOrgValue} />
        </div>

        <div>
          <label className="field-label">How did you hear about us? *</label>
          <select
            name="heard_about"
            required
            defaultValue=""
            className="field-input mt-1"
          >
            <option value="">— Select —</option>
            {HEARD_ABOUT.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          {err("heard_about")}
        </div>

        <div>
          <label className="field-label">Referred by *</label>
          <input
            name="referred_by"
            required
            placeholder="Name of the person or organization who referred you"
            className="field-input mt-1"
          />
          {err("referred_by")}
        </div>
      </fieldset>

      {state?.ok === false && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
          {state.error}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-crimson h-12 px-8" disabled={pending}>
          {pending ? "Registering…" : "Complete Registration →"}
        </button>
      </div>
    </form>
  );
}
