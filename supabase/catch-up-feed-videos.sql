-- Standalone catch-up: video posts in the Feed.
-- Safe to run on its own — every statement is guarded.

alter table feed_posts add column if not exists video_url text;

-- The original constraint only allowed text-or-photos; a video-only
-- post needs to satisfy it too, so it's re-created here.
alter table feed_posts drop constraint if exists feed_posts_check;
alter table feed_posts add constraint feed_posts_check
  check (coalesce(text, '') <> '' or array_length(photos, 1) > 0 or video_url is not null);

insert into storage.buckets (id, name, public, file_size_limit)
values ('feed-videos', 'feed-videos', true, 52428800) -- 50MB
on conflict (id) do update set file_size_limit = 52428800;

drop policy if exists "Feed videos are publicly readable" on storage.objects;
create policy "Feed videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'feed-videos');

drop policy if exists "Users can upload their own feed videos" on storage.objects;
create policy "Users can upload their own feed videos"
  on storage.objects for insert
  with check (bucket_id = 'feed-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own feed videos" on storage.objects;
create policy "Users can delete their own feed videos"
  on storage.objects for delete
  using (bucket_id = 'feed-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Sanity check
select
  (select count(*) from information_schema.columns where table_name = 'feed_posts' and column_name = 'video_url') as has_video_url,
  (select count(*) from storage.buckets where id = 'feed-videos') as has_video_bucket;
