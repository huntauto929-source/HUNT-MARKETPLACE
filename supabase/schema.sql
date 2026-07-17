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
  created_at timestamptz not null default now(),
  -- Personal info is private by default. A member opts in per field to
  -- surface a privacy-safe derivative of it (age, not raw dob; contact
  -- value as-is) on their public profile.
  dob_public boolean not null default false,
  contact_public boolean not null default false
);

-- Safe to re-run on an existing database that already has the table
-- from before these columns existed.
alter table profiles add column if not exists dob_public boolean not null default false;
alter table profiles add column if not exists contact_public boolean not null default false;

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

-- Public, personal-info-free-by-default view of a profile. Views in
-- Postgres run with the privileges of the view's owner (not the
-- visitor), so this can safely expose these columns to everyone —
-- including anonymous visitors — while keeping dob/contact_value
-- hidden unless the member has explicitly opted in.
--
-- Note we expose AGE (an integer, derived from dob), never the raw
-- date of birth, even when dob_public is true — that's enough for
-- other members to see, without handing out an exact birthdate.
create or replace view public_profiles as
  select
    id,
    username,
    name,
    created_at,
    case when dob_public and dob is not null
      then date_part('year', age(dob))::int
      else null
    end as age,
    case when contact_public then contact_method else null end as contact_method,
    case when contact_public then contact_value else null end as contact_value
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


-- ---------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------
-- One review per (reviewer, listing) — a buyer can leave one review
-- for the seller of a given listing after buying it. The app only
-- surfaces the "Leave a review" button from a completed order, but
-- the uniqueness constraint is what actually stops someone from
-- spamming multiple reviews at the DB level.

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  reviewer_username text not null,
  target_username text not null,
  listing_id text not null,
  listing_title text,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (reviewer_id, listing_id)
);

alter table reviews enable row level security;

-- Reviews are public — that's the point of them — but only the
-- author can ever create one, and only as themselves. There's no
-- update/delete policy, so reviews can't be edited after posting
-- (keeps them trustworthy); reach into the dashboard directly for
-- moderation takedowns.
create policy "Reviews are publicly readable"
  on reviews for select
  using (true);

create policy "Users can leave reviews as themselves"
  on reviews for insert
  with check (auth.uid() = reviewer_id);

-- Re-published with rating + review_count folded in, so the app can
-- get a member's public info and their review summary in one query.
create or replace view public_profiles as
  select
    p.id,
    p.username,
    p.name,
    p.created_at,
    case when p.dob_public and p.dob is not null
      then date_part('year', age(p.dob))::int
      else null
    end as age,
    case when p.contact_public then p.contact_method else null end as contact_method,
    case when p.contact_public then p.contact_value else null end as contact_value,
    coalesce(r.review_count, 0) as review_count,
    r.avg_rating
  from profiles p
  left join (
    select target_username, count(*) as review_count, round(avg(rating)::numeric, 1) as avg_rating
    from reviews
    group by target_username
  ) r on r.target_username = p.username;

grant select on public_profiles to anon, authenticated;
grant select on reviews to anon, authenticated;


-- ---------------------------------------------------------------
-- Listing photos (Supabase Storage)
-- ---------------------------------------------------------------
-- One public bucket. Uploads are only accepted into a folder named
-- after the uploader's own auth uid (`<uid>/<file>`), and only that
-- uid can delete from it — enforced below, not just by app code.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "Listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "Users can upload their own listing photos"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own listing photos"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
