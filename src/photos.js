import { supabase } from "./supabaseClient.js";

/**
 * Listing photo uploads, backed by the `listing-photos` Supabase
 * Storage bucket (see supabase/schema.sql). Every file is written
 * under `<uid>/<random>.<ext>` — the storage policies only let a user
 * write/delete inside their own uid folder, so this is safe even
 * though the bucket itself is publicly readable (that's what lets
 * listing photos actually render for other members).
 */

const MAX_PHOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB per photo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validatePhotoFiles(files, existingCount = 0) {
  const list = Array.from(files || []);
  if (existingCount + list.length > MAX_PHOTOS) {
    throw new Error(`You can add up to ${MAX_PHOTOS} photos per listing.`);
  }
  for (const f of list) {
    if (!ALLOWED_TYPES.includes(f.type)) {
      throw new Error(`${f.name} isn't a supported image type (JPEG, PNG, WEBP, GIF).`);
    }
    if (f.size > MAX_BYTES) {
      throw new Error(`${f.name} is too large — photos must be under 8MB.`);
    }
  }
  return list;
}

export async function uploadListingPhotos(files) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be logged in to upload photos.");

  const list = validatePhotoFiles(files);
  const urls = [];
  for (const file of list) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export async function deleteListingPhotos(urls) {
  const paths = (urls || [])
    .map((u) => {
      const marker = "/listing-photos/";
      const i = u.indexOf(marker);
      return i === -1 ? null : u.slice(i + marker.length);
    })
    .filter(Boolean);
  if (!paths.length) return;
  const { error } = await supabase.storage.from("listing-photos").remove(paths);
  if (error) throw error;
}

export async function uploadAvatar(file) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be logged in to update your photo.");
  validatePhotoFiles([file], 0);

  // Fixed path (no extension) so re-uploading overwrites in place —
  // upsert — instead of piling up old avatar files. contentType is
  // set explicitly so the browser renders it correctly regardless.
  const path = `${session.user.id}/avatar`;
  const { error } = await supabase.storage.from("listing-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
  // Cache-bust: same URL every time, so force a fresh fetch.
  return `${data.publicUrl}?t=${Date.now()}`;
}

export { MAX_PHOTOS };

/**
 * Feed video uploads, backed by the `feed-videos` Supabase Storage
 * bucket — separate from listing-photos since videos need a much
 * higher size ceiling and only ever attach to feed posts.
 */

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB, matches the bucket's file_size_limit
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export function validateVideoFile(file) {
  if (!file) return;
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error(`${file.name} isn't a supported video type (MP4, WEBM, or MOV).`);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Videos must be under 50MB.");
  }
}

export async function uploadFeedVideo(file) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be logged in to upload a video.");
  validateVideoFile(file);

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("feed-videos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("feed-videos").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFeedVideo(url) {
  if (!url) return;
  const marker = "/feed-videos/";
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length);
  const { error } = await supabase.storage.from("feed-videos").remove([path]);
  if (error) throw error;
}
