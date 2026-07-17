-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security is on by default for new projects. These policies
-- let the app's anon key read and write freely, since HunT does its
-- own username/password checks in the app layer rather than using
-- Supabase Auth sessions. This is fine for a demo or MVP, but it does
-- mean anyone with your anon key could read/write this table directly
-- (not just through the app UI). See the README for how to lock this
-- down further once you're ready to add real Supabase Auth + per-row
-- Row Level Security tied to auth.uid().

alter table kv_store enable row level security;

create policy "Public read access"
  on kv_store for select
  using (true);

create policy "Public write access"
  on kv_store for insert
  with check (true);

create policy "Public update access"
  on kv_store for update
  using (true);

create policy "Public delete access"
  on kv_store for delete
  using (true);

-- Helpful for the prefix-scan queries the app runs (e.g. listing every
-- chat conversation or every registered user).
create index if not exists kv_store_key_prefix_idx on kv_store (key text_pattern_ops);
