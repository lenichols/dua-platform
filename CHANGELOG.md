# Changelog

All notable changes to Dua are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from 1.0.

## [0.1.0] - 2026-11-13

### Added

- Public registration, mentor sign-up and project submission with private edit
  links.
- Judge and mentor sign-in, rubric scoring with evidence, and conflict
  declarations.
- Two ranking methods: plain averages and per-judge normalized Monte Carlo with
  a reproducible seed.
- Admin panel for phases, registrations, judges, submissions, email campaigns,
  results and the admin team.
- Event settings for dates, forms, rubric, theme, feature switches and judging
  rules.
- Optional Resend/SMTP email, S3/Supabase/database storage, and Supabase Auth
  for judge sign-in.
- Demo mode with sample data and an hourly reset endpoint.
