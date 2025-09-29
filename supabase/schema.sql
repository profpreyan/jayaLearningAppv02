-- Schema and seed data for the Learning App Supabase backend
-- Run this script in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  role text not null check (role in ('admin', 'learner')),
  full_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  coins_balance integer not null default 0,
  streak_days integer not null default 0,
  badges_earned integer not null default 0,
  total_check_ins integer not null default 0,
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

create type assignment_status as enum ('Pending', 'Submitted', 'Checked');

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  day_label text not null,
  title text not null,
  summary_lines text[] not null,
  due_label text not null,
  base_status assignment_status not null default 'Pending',
  is_locked_by_default boolean not null default true,
  unlock_cost integer not null default 0,
  hint_cost integer not null default 0,
  is_current_day boolean not null default false,
  hints text[] not null default '{}',
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assignment_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status assignment_status not null default 'Pending',
  locked boolean not null default true,
  hints_unlocked boolean not null default false,
  submission_link text,
  submission_notes text,
  submission_asset_paths text[] not null default '{}',
  submitted_at timestamptz,
  feedback text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  coins_spent_on_unlocks integer not null default 0,
  coins_spent_on_hints integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, user_id)
);

create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  emotion text,
  motivation text,
  energy text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  logged_in_at timestamptz not null default timezone('utc', now()),
  client_notes text
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists learner_profiles_set_updated_at on public.learner_profiles;
create trigger learner_profiles_set_updated_at before update on public.learner_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

drop trigger if exists assignment_progress_set_updated_at on public.assignment_progress;
create trigger assignment_progress_set_updated_at before update on public.assignment_progress
  for each row execute function public.set_updated_at();

-- Row level security policies to allow the client to operate with anon key.
alter table public.users enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.mood_entries enable row level security;
alter table public.login_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'users_read') then
    create policy users_read on public.users for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'learner_profiles' and policyname = 'learner_profiles_select') then
    create policy learner_profiles_select on public.learner_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'learner_profiles' and policyname = 'learner_profiles_update') then
    create policy learner_profiles_update on public.learner_profiles for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assignments' and policyname = 'assignments_read') then
    create policy assignments_read on public.assignments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assignment_progress' and policyname = 'assignment_progress_select') then
    create policy assignment_progress_select on public.assignment_progress for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assignment_progress' and policyname = 'assignment_progress_modify') then
    create policy assignment_progress_modify on public.assignment_progress for insert with check (true);
    create policy assignment_progress_update on public.assignment_progress for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'mood_entries' and policyname = 'mood_entries_insert') then
    create policy mood_entries_insert on public.mood_entries for insert with check (true);
    create policy mood_entries_read on public.mood_entries for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'login_events' and policyname = 'login_events_insert') then
    create policy login_events_insert on public.login_events for insert with check (true);
    create policy login_events_read on public.login_events for select using (true);
  end if;
end$$;

-- Seed admin and learner records.
with upsert_admin as (
  insert into public.users (code, role, full_name)
  values ('PRE18', 'admin', 'Educator Admin')
  on conflict (code) do update set role = excluded.role, full_name = excluded.full_name
  returning id
), upsert_learner as (
  insert into public.users (code, role, full_name)
  values ('JA001', 'learner', 'Jaya Learner')
  on conflict (code) do update set role = excluded.role, full_name = excluded.full_name
  returning id
)
insert into public.learner_profiles (user_id, display_name, avatar_url, coins_balance, streak_days, badges_earned, total_check_ins)
select id, 'Jaya', null, 65, 6, 3, 0 from upsert_learner
on conflict (user_id) do update set
  display_name = excluded.display_name,
  coins_balance = excluded.coins_balance,
  streak_days = excluded.streak_days,
  badges_earned = excluded.badges_earned;

-- Seed assignments (idempotent via slug conflict).
insert into public.assignments (
  slug,
  day_label,
  title,
  summary_lines,
  due_label,
  base_status,
  is_locked_by_default,
  unlock_cost,
  hint_cost,
  is_current_day,
  hints,
  display_order
)
values
  (
    'week4-mon',
    'Monday',
    'Kickoff Reflection',
    ARRAY[
      'Share a win from last week',
      'List your top 3 learning goals',
      'Record one question for your mentor',
      'Describe the environment you are working in',
      'Estimate 2 hours for deep work'
    ],
    'Due Monday by 8 PM',
    'Checked',
    false,
    0,
    3,
    false,
    ARRAY[
      'Focus on specific, measurable goals to help your mentor respond.',
      'Use the question to unblock a challenge you encountered recently.'
    ],
    1
  ),
  (
    'week4-tue',
    'Tuesday',
    'Concept Drill',
    ARRAY[
      'Watch the Chapter 3 walkthrough',
      'Summarize the 3 core takeaways',
      'Implement the sample snippet',
      'Note one area to improve',
      'Upload your edited code'
    ],
    'Due Tuesday by 8 PM',
    'Submitted',
    false,
    0,
    4,
    false,
    ARRAY[
      'Keep your summary under 120 words for quick review.',
      'Highlight the snippet differences so mentors can scan fast.'
    ],
    2
  ),
  (
    'week4-wed',
    'Wednesday',
    'Project Milestone',
    ARRAY[
      'Complete user research interviews',
      'Translate findings into 3 insights',
      'Upload the interview notes',
      'Sketch a draft solution',
      'Define one success metric'
    ],
    'Due Wednesday by 8 PM',
    'Pending',
    false,
    0,
    5,
    true,
    ARRAY[
      'Use quotes from interviews to back each insight.',
      'Choose a metric you can actually capture this week.'
    ],
    3
  ),
  (
    'week4-thu',
    'Thursday',
    'Mentor Sync Prep',
    ARRAY[
      'Prepare 2 demo talking points',
      'Outline blockers that need support',
      'Draft questions about this week''s content',
      'Upload supporting visuals',
      'Share the meeting agenda'
    ],
    'Unlock to view due date',
    'Pending',
    true,
    10,
    6,
    false,
    ARRAY[
      'Think about where your mentor can remove ambiguity.',
      'Your agenda should include time for feedback loops.'
    ],
    4
  ),
  (
    'week4-fri',
    'Friday',
    'Demo Day Rehearsal',
    ARRAY[
      'Record a short walkthrough video',
      'List feedback from teammates',
      'Plan updates before next sprint',
      'Upload revised slides',
      'Leave a link to your rehearsal clip'
    ],
    'Unlock to view due date',
    'Pending',
    true,
    12,
    6,
    false,
    ARRAY[
      'Keep the walkthrough under 5 minutes for quick critique.',
      'Capture action items in bullet points for clarity.'
    ],
    5
  ),
  (
    'week4-weekend',
    'Weekend Wrap',
    'Weekly Reflection',
    ARRAY[
      'Summarize your biggest insight',
      'Call out one blocker',
      'Set your intention for next week',
      'Upload any supporting artifacts',
      'Celebrate a win from the week'
    ],
    'Unlock to view due date',
    'Pending',
    true,
    8,
    5,
    false,
    ARRAY[
      'Use the blocker call-out to request mentor support early.',
      'Intentions work best when they include a measurable target.'
    ],
    6
  )
on conflict (slug) do update set
  day_label = excluded.day_label,
  title = excluded.title,
  summary_lines = excluded.summary_lines,
  due_label = excluded.due_label,
  base_status = excluded.base_status,
  is_locked_by_default = excluded.is_locked_by_default,
  unlock_cost = excluded.unlock_cost,
  hint_cost = excluded.hint_cost,
  is_current_day = excluded.is_current_day,
  hints = excluded.hints,
  display_order = excluded.display_order;

-- Ensure the storage bucket for submission assets exists and is public.
insert into storage.buckets (id, name, public)
select 'submission-assets', 'submission-assets', true
where not exists (select 1 from storage.buckets where name = 'submission-assets');

update storage.buckets set public = true where name = 'submission-assets';

comment on bucket storage."submission-assets" is 'Holds learner submission image uploads.';

-- Optional seed: give the learner a sample submission on Tuesday.
with learner as (
  select id from public.users where code = 'JA001' limit 1
), assignment as (
  select id from public.assignments where slug = 'week4-tue' limit 1
)
insert into public.assignment_progress (
  assignment_id,
  user_id,
  status,
  locked,
  hints_unlocked,
  submission_link,
  submitted_at,
  coins_spent_on_unlocks,
  coins_spent_on_hints
)
select assignment.id, learner.id, 'Submitted', false, false, 'https://example.com/submission', timezone('utc', now()) - interval '1 day', 0, 0
from learner, assignment
on conflict (assignment_id, user_id) do update set
  status = excluded.status,
  locked = excluded.locked,
  submission_link = excluded.submission_link,
  submitted_at = excluded.submitted_at;
