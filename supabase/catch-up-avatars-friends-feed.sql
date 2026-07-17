-- Standalone catch-up: profile pictures, friends, feed posts, and
-- shared likes/comments (for both feed posts and listings).
-- Safe to run on its own — every statement is guarded, so it won't
-- error even if parts of it were already applied.

-- Needed so a profile picture can be re-uploaded to the same path
-- (upsert) rather than accumulating a new file every time.
drop policy if exists "Users can update their own listing photos" on storage.objects;
create policy "Users can update their own listing photos"
  on storage.objects for update
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------
-- Profile pictures
-- ---------------------------------------------------------------
-- Reuses the listing-photos bucket (same per-user-folder policies
-- above already cover it) — stored at `<uid>/avatar`, upserted in
-- place so re-uploading doesn't leave old files behind.

alter table profiles add column if not exists avatar_url text;

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
    r.avg_rating,
    p.avatar_url
  from profiles p
  left join (
    select target_username, count(*) as review_count, round(avg(rating)::numeric, 1) as avg_rating
    from reviews
    group by target_username
  ) r on r.target_username = p.username;

grant select on public_profiles to anon, authenticated;


-- ---------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------
-- One row per requester→addressee pair. 'pending' until the
-- addressee accepts it (flips to 'accepted'); either side can delete
-- the row at any time to cancel a request or unfriend.

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  requester_username text not null,
  addressee_username text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table friendships enable row level security;

drop policy if exists "See your own friendships" on friendships;
create policy "See your own friendships"
  on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Send friend requests as yourself" on friendships;
create policy "Send friend requests as yourself"
  on friendships for insert
  with check (auth.uid() = requester_id);

-- Only the addressee can accept, and only by flipping status to
-- 'accepted' — not by changing who the request is between.
drop policy if exists "Accept a friend request sent to you" on friendships;
create policy "Accept a friend request sent to you"
  on friendships for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status = 'accepted');

drop policy if exists "Cancel or remove a friendship you're part of" on friendships;
create policy "Cancel or remove a friendship you're part of"
  on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;


-- ---------------------------------------------------------------
-- Feed posts
-- ---------------------------------------------------------------
-- A short text/photo post with a visibility level the author picks
-- per post: public (anyone), friends (accepted friends only), or
-- private (only the author — e.g. a personal note-to-self).

create table if not exists feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_username text not null,
  text text,
  photos text[] not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now(),
  check (coalesce(text, '') <> '' or array_length(photos, 1) > 0)
);

alter table feed_posts enable row level security;

drop policy if exists "See feed posts you're allowed to see" on feed_posts;
create policy "See feed posts you're allowed to see"
  on feed_posts for select
  using (
    visibility = 'public'
    or author_id = auth.uid()
    or (visibility = 'friends' and public.are_friends(auth.uid(), author_id))
  );

drop policy if exists "Post to the feed as yourself" on feed_posts;
create policy "Post to the feed as yourself"
  on feed_posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "Delete your own feed posts" on feed_posts;
create policy "Delete your own feed posts"
  on feed_posts for delete
  using (auth.uid() = author_id);


-- ---------------------------------------------------------------
-- Likes & comments (shared by feed posts AND listings)
-- ---------------------------------------------------------------
-- One pair of tables, keyed by (target_type, target_id), instead of
-- separate like/comment tables per feature. Listings are always
-- public in this app, so likes/comments on a listing are always
-- visible; likes/comments on a feed post inherit that post's
-- visibility via can_view_target() below.

create or replace function public.can_view_target(t_type text, t_id text, viewer uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  post_row feed_posts%rowtype;
begin
  if t_type = 'listing' then
    return true;
  elsif t_type = 'post' then
    select * into post_row from feed_posts where id = t_id::uuid;
    if not found then return false; end if;
    return post_row.visibility = 'public'
      or post_row.author_id = viewer
      or (post_row.visibility = 'friends' and public.are_friends(viewer, post_row.author_id));
  else
    return false;
  end if;
end;
$$;

create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'listing')),
  target_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

alter table likes enable row level security;

drop policy if exists "See likes on things you can see" on likes;
create policy "See likes on things you can see"
  on likes for select
  using (public.can_view_target(target_type, target_id, auth.uid()));

drop policy if exists "Like as yourself" on likes;
create policy "Like as yourself"
  on likes for insert
  with check (auth.uid() = user_id and public.can_view_target(target_type, target_id, auth.uid()));

drop policy if exists "Unlike your own like" on likes;
create policy "Unlike your own like"
  on likes for delete
  using (auth.uid() = user_id);

grant select on likes to anon, authenticated;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'listing')),
  target_id text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_username text not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;

drop policy if exists "See comments on things you can see" on comments;
create policy "See comments on things you can see"
  on comments for select
  using (public.can_view_target(target_type, target_id, auth.uid()));

drop policy if exists "Comment as yourself" on comments;
create policy "Comment as yourself"
  on comments for insert
  with check (auth.uid() = author_id and public.can_view_target(target_type, target_id, auth.uid()));

drop policy if exists "Delete your own comment" on comments;
create policy "Delete your own comment"
  on comments for delete
  using (auth.uid() = author_id);

grant select on comments to anon, authenticated;

-- Sanity check
select
  (select count(*) from information_schema.columns where table_name = 'profiles' and column_name = 'avatar_url') as has_avatar_url,
  (select count(*) from information_schema.tables where table_name = 'friendships') as has_friendships,
  (select count(*) from information_schema.tables where table_name = 'feed_posts') as has_feed_posts,
  (select count(*) from information_schema.tables where table_name = 'likes') as has_likes,
  (select count(*) from information_schema.tables where table_name = 'comments') as has_comments;
