-- Run this in Supabase SQL Editor. It only adds what's NEW (reviews +
-- listing photo storage) and skips anything from schema.sql you've
-- already run before, so it won't hit "already exists" errors.

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

drop policy if exists "Reviews are publicly readable" on reviews;
create policy "Reviews are publicly readable"
  on reviews for select
  using (true);

drop policy if exists "Users can leave reviews as themselves" on reviews;
create policy "Users can leave reviews as themselves"
  on reviews for insert
  with check (auth.uid() = reviewer_id);

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

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "Listing photos are publicly readable" on storage.objects;
create policy "Listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists "Users can upload their own listing photos" on storage.objects;
create policy "Users can upload their own listing photos"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own listing photos" on storage.objects;
create policy "Users can delete their own listing photos"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
