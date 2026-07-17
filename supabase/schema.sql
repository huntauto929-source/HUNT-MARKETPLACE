-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security is on by default for new projects. These policies
-- let the app's anon key read and write listings/chats/orders freely.
-- Real identity checks now live in the `profiles` and `reports` tables
-- below (tied to Supabase Auth), but this kv_store table itself is
-- still open to anyone with your anon key, not just through the app
-- UI. Tightening these to check auth.uid() against the listing's
-- seller/buyer is the natural next security upgrade once you're
-- handling real transactions.

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


-- ---------------------------------------------------------------
-- Real accounts (Supabase Auth) support
-- ---------------------------------------------------------------
-- Run this section too if you're upgrading HunT to use real email
-- signup/login/password-reset instead of the demo homegrown auth.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  name text not null,
  dob date,
  contact_method text,
  contact_value text,
  restricted boolean not null default false,
  report_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- IMPORTANT: profiles holds sensitive fields (dob, contact_method,
-- contact_value), so the full row is only readable by its owner.
-- Public-safe fields (username, name, member-since date) are exposed
-- through the `public_profiles` view below instead — that's what
-- listings, chats, and profile-viewing in the app actually query.
create policy "Users can read their own full profile"
  on profiles for select
  using (auth.uid() = id);

-- But only the account owner can ever create or edit their own row.
-- Note: this intentionally does NOT let people un-restrict themselves —
-- restricted/report_count are only ever changed by the trigger below
-- (or by you directly in the Table Editor for manual appeals).
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and restricted = (select restricted from profiles where id = auth.uid())
    and report_count = (select report_count from profiles where id = auth.uid())
  );

-- Public, personal-info-free view of a profile. Views in Postgres run
-- with the privileges of the view's owner (not the visitor), so this
-- can safely expose just these three columns to everyone — including
-- anonymous visitors — without ever touching dob/contact_value, even
-- though those columns exist on the underlying table.
create or replace view public_profiles as
  select id, username, name, created_at
  from profiles;

grant select on public_profiles to anon, authenticated;

-- Automatically creates a profiles row the moment someone confirms
-- signup, using the username/name/dob passed in at signUp() time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, dob)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    new.raw_user_meta_data->>'name',
    nullif(new.raw_user_meta_data->>'dob', '')::date
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------------
-- Reports & auto-restriction
-- ---------------------------------------------------------------
-- Lets a buyer/seller report a listing or another member. Nobody can
-- restrict an account by themselves — restriction only happens once a
-- REPORT_THRESHOLD number of different people have reported the same
-- account, and it's the database (not the app) that decides that, so
-- it can't be bypassed from the browser.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_username text not null,
  listing_id text,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_username, listing_id)
);

alter table reports enable row level security;

-- Anyone logged in can file a report, but only as themselves.
create policy "Users can file reports as themselves"
  on reports for insert
  with check (auth.uid() = reporter_id);

-- Reports are not publicly readable — only visible via the Supabase
-- dashboard (as the project owner) for moderation review.

-- How many distinct reports before an account is auto-restricted.
-- Change this number and re-run just this line if you want a
-- different threshold later.
create or replace function public.report_threshold()
returns int language sql immutable as $$ select 3 $$;

create or replace function public.handle_new_report()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  distinct_reporters int;
begin
  select count(distinct reporter_id) into distinct_reporters
  from reports
  where target_username = new.target_username;

  update profiles
  set report_count = distinct_reporters,
      restricted = (distinct_reporters >= public.report_threshold())
  where username = new.target_username;

  return new;
end;
$$;

drop trigger if exists on_report_created on reports;
create trigger on_report_created
  after insert on reports
  for each row execute procedure public.handle_new_report();
