-- Law School Command Center storage table.
-- Run once in the Dinner Planner Supabase project (SQL Editor → New query → paste → Run).
-- One row per user, jsonb columns, RLS so each user only sees their own row —
-- same pattern as the dinner planner's user_data table.

create table public.law_school_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  courses jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  public_service_log jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.law_school_data enable row level security;

create policy "own row select" on public.law_school_data
  for select using (auth.uid() = user_id);

create policy "own row insert" on public.law_school_data
  for insert with check (auth.uid() = user_id);

create policy "own row update" on public.law_school_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own row delete" on public.law_school_data
  for delete using (auth.uid() = user_id);
