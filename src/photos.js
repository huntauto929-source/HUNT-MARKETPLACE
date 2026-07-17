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

export { MAX_PHOTOS };
