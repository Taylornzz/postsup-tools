-- Kaos Theory — News Watches: per-user watches + generated digests, with RLS.
-- Phase 2. NOT YET APPLIED — Phase 1 stores watches in the browser (localStorage).
-- Apply this when wiring the scheduled job + email, alongside the edge function.
-- Idempotent: safe to run more than once.

-- A "watch" is a plain-English topic the user wants tracked.
create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  regions text[] not null default '{}',
  keywords text[] not null default '{}',
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly')),
  delivery text not null default 'both' check (delivery in ('email', 'feed', 'both')),
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watches_user_idx on public.watches (user_id, updated_at desc);
-- Used by the scheduler to find watches due to run.
create index if not exists watches_due_idx on public.watches (enabled, last_run_at);

alter table public.watches enable row level security;

drop policy if exists "watches_select_own" on public.watches;
create policy "watches_select_own" on public.watches
  for select using (auth.uid() = user_id);

drop policy if exists "watches_insert_own" on public.watches;
create policy "watches_insert_own" on public.watches
  for insert with check (auth.uid() = user_id);

drop policy if exists "watches_update_own" on public.watches;
create policy "watches_update_own" on public.watches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watches_delete_own" on public.watches;
create policy "watches_delete_own" on public.watches
  for delete using (auth.uid() = user_id);

-- A "digest" is one generated summary for a watch (the in-app feed + what gets emailed).
create table if not exists public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id uuid not null references public.watches (id) on delete cascade,
  watch_topic text not null,
  tldr text not null,
  items jsonb not null default '[]'::jsonb,
  sample boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists digests_user_idx on public.digests (user_id, created_at desc);
create index if not exists digests_watch_idx on public.digests (watch_id, created_at desc);

alter table public.digests enable row level security;

-- Read/delete are the user's; inserts are written by the service-role scheduler,
-- which bypasses RLS. A self-insert policy is included for on-demand previews.
drop policy if exists "digests_select_own" on public.digests;
create policy "digests_select_own" on public.digests
  for select using (auth.uid() = user_id);

drop policy if exists "digests_insert_own" on public.digests;
create policy "digests_insert_own" on public.digests
  for insert with check (auth.uid() = user_id);

drop policy if exists "digests_delete_own" on public.digests;
create policy "digests_delete_own" on public.digests
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh (reuses public.set_updated_at from 0001).
drop trigger if exists watches_set_updated_at on public.watches;
create trigger watches_set_updated_at
  before update on public.watches
  for each row execute function public.set_updated_at();
