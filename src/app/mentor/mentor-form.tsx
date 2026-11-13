"use client";

import { useActionState } from "react";
import { registerMentor } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import { useEvent } from "@/components/event-context";

export function MentorForm() {
  const EVENT = useEvent();
  const {
    heardAbout: HEARD_ABOUT,
    mentorExperienceLevels: MENTOR_EXPERIENCE_LEVELS,
    tracks: TRACKS,
  } = EVENT;
  const [state, action, pending] = useActionState(registerMentor, null);

  if (state?.ok) {
    return (
      <div className="card">
        <div className="pill-accent mb-4">✓ You&apos;re In</div>
        <h2 className="hex-title text-4xl">Thank You for Stepping Up.</h2>
        <p className="mt-3 text-dust">
          Thanks for signing up to mentor at {EVENT.name}.
          We&apos;ll review your profile and reach out with next steps — mentor
          profiles are shared with participants once registration opens.
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
        <legend className="pill-accent -mt-2 mb-2">1. About You</legend>

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
            <label className="field-label">Title / Occupation *</label>
            <input
              name="occupation"
              required
              placeholder="e.g. Senior Engineer, Policy Advisor"
              className="field-input mt-1"
            />
            {err("occupation")}
          </div>
          <div>
            <label className="field-label">Organization</label>
            <input
              name="organization"
              placeholder="Company, utility, university, or independent"
              autoComplete="organization"
              className="field-input mt-1"
            />
          </div>
          <div>
            <label className="field-label">LinkedIn Profile *</label>
            <input
              name="linkedin_url"
              type="url"
              required
              inputMode="url"
              placeholder="https://linkedin.com/in/you"
              className="field-input mt-1"
            />
            {err("linkedin_url")}
            <p className="mt-1 text-xs text-dust">
              Required — mentor profiles are shared with participants.
            </p>
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
        </div>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="pill-accent -mt-2 mb-2">
          2. How You&apos;ll Mentor
        </legend>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">
              Which track can you mentor? *
            </label>
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
              {MENTOR_EXPERIENCE_LEVELS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            {err("experience_level")}
          </div>
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
        <button type="submit" className="btn-accent h-12 px-8" disabled={pending}>
          {pending ? "Signing up…" : "Sign Up to Mentor"}
        </button>
      </div>
    </form>
  );
}
