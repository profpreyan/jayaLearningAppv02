# Supabase Setup Guide

The app expects a Supabase project for persisting learners, assignments, and submissions. The steps below set up the schema, sample data, and required configuration.

## 1. Create or reuse a Supabase project

1. Sign in to [Supabase](https://supabase.com/) and create a new project (free tier is fine).
2. Once the project is ready, open **Project Settings ▸ API** and copy the following values:
   - `Project URL`
   - `anon public` API key

You will place these in the Vite environment file later.

## 2. Apply the schema and seed data

1. In the Supabase dashboard, open **SQL Editor**.
2. Create a new script and paste the contents of `supabase/schema.sql` from this repository.
3. Run the script. It will:
   - Create all required tables and enum types.
   - Enable row level security with permissive policies for the anon key (suitable for this passcode-protected prototype).
   - Seed the two passcode users (`PRE18` educator and `JA001` learner) plus the weekly assignments.
   - Create a public storage bucket named `submission-assets`.
   - Insert a sample submission record for Tuesday so the educator dashboard has real data to review.

You can re-run the script safely; it uses `on conflict` upserts to keep data idempotent.

## 3. Configure storage (optional checks)

The SQL script creates the `submission-assets` bucket and marks it as public. If you need to validate manually:

1. Visit **Storage ▸ Buckets** and confirm the bucket exists and is public.
2. (Optional) Add a file rule to cap uploads to ~5MB if you want tighter control.

The front-end uploads images directly to this bucket using the anon key.

## 4. Environment variables for Vite

Create a file named `.env.local` inside `webapp/` with the Supabase credentials:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Restart `npm run dev` after adding or changing these values so Vite picks them up.

## 5. Passcodes and roles

The current build expects only two passcodes:

| Code  | Role      | Behaviour                                           |
|-------|-----------|------------------------------------------------------|
| PRE18 | Educator  | Bypasses mood flow and lands on the admin dashboard. |
| JA001 | Learner   | Runs the mood flow, shows the gamified dashboard.    |

Invalid codes surface an error toast in the login screen.

## 6. How data flows

- Learner logins create a row in `login_events`, update `learner_profiles.last_login_at`, and insert a mood entry in `mood_entries`.
- The learner dashboard reads assignments plus progress from `assignments` and `assignment_progress` and pushes updates when unlocking, requesting hints, or submitting work.
- The educator dashboard queries the same tables, surfaces submission assets from the `submission-assets` bucket, and lets the admin update status/feedback via `assignment_progress`.

## 7. Next steps and tweaks

- If you introduce additional learners, insert new rows into `public.users` (role `learner`) and `public.learner_profiles` with a unique `code` string.
- For tighter security you can replace the permissive RLS policies with user-based checks once Supabase Auth is wired in; the current setup keeps things simple for the prototype.
- To wipe data between demos, truncate the `assignment_progress`, `mood_entries`, and `login_events` tables and reset `learner_profiles` coin totals.

That’s it—once the schema is applied and the environment variables are set, `npm run dev` will connect to Supabase automatically.
