import { supabase } from "./supabaseClient.js";

/**
 * Real account system backed by Supabase Auth, replacing the old
 * demo hashed-password-in-a-table approach. This gives HunT:
 *  - real email confirmation on signup
 *  - real self-service "forgot password" emails
 *  - real sessions (auto-refreshing, persisted in the browser)
 *
 * A `profiles` row (see supabase/schema.sql) stores the HunT-specific
 * fields (username, display name, date of birth, linked contact) and
 * is created automatically by a database trigger when someone signs up.
 */

export async function signUp({ email, password, username, name }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // dob is deliberately not collected here anymore — it's added
      // later, by choice, from the private profile settings screen.
      data: { username: username.toLowerCase(), name },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=1`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) return null;
  return await fetchProfileForSession(session);
}

export function onAuthChange(callback) {
  const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
      callback(null, event);
      return;
    }
    try {
      const user = await fetchProfileForSession(session);
      callback(user, event);
    } catch (err) {
      console.error("Failed to load profile after auth change:", err);
      callback(null, event);
    }
  });
  return () => sub.subscription.unsubscribe();
}

export async function fileReport({ targetUsername, listingId, reason }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be logged in to report something.");
  const { error } = await supabase.from("reports").insert({
    reporter_id: session.user.id,
    target_username: targetUsername.toLowerCase(),
    listing_id: listingId || null,
    reason,
  });
  if (error) throw error;
}

export async function updateProfile({ name, dob, contactMethod, contactValue, dobPublic, contactPublic }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be logged in to update your profile.");

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (dob !== undefined) patch.dob = dob || null;
  if (contactMethod !== undefined) patch.contact_method = contactMethod;
  if (contactValue !== undefined) patch.contact_value = contactValue;
  if (dobPublic !== undefined) patch.dob_public = dobPublic;
  if (contactPublic !== undefined) patch.contact_public = contactPublic;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", session.user.id)
    .select()
    .single();
  if (error) throw error;

  return {
    name: profile.name,
    dob: profile.dob || "",
    contactMethod: profile.contact_method || null,
    contactValue: profile.contact_value || null,
    dobPublic: !!profile.dob_public,
    contactPublic: !!profile.contact_public,
  };
}

export async function submitReview({ targetUsername, listingId, listingTitle, rating, comment }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be logged in to leave a review.");
  const meta = session.user.user_metadata || {};
  const { error } = await supabase.from("reviews").insert({
    reviewer_id: session.user.id,
    reviewer_username: (meta.username || "").toLowerCase(),
    target_username: targetUsername.toLowerCase(),
    listing_id: listingId,
    listing_title: listingTitle || null,
    rating,
    comment: comment?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("You've already reviewed this purchase.");
    throw error;
  }
}

export async function getReviews(username) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, reviewer_username, rating, comment, created_at, listing_title")
    .eq("target_username", username.trim().toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    reviewerUsername: r.reviewer_username,
    rating: r.rating,
    comment: r.comment,
    listingTitle: r.listing_title,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function getMyReviewedListingIds() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("listing_id")
    .eq("reviewer_id", session.user.id);
  if (error) throw error;
  return (data || []).map((r) => r.listing_id);
}

export async function getPublicProfile(username) {
  const uname = username.trim().toLowerCase();
  const { data: profile, error } = await supabase
    .from("public_profiles")
    .select("username, name, created_at, age, contact_method, contact_value, review_count, avg_rating")
    .eq("username", uname)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  return {
    username: profile.username,
    name: profile.name,
    createdAt: new Date(profile.created_at).getTime(),
    // Only present when the member opted in — see public_profiles view.
    age: profile.age ?? null,
    contactMethod: profile.contact_method || null,
    contactValue: profile.contact_value || null,
    reviewCount: profile.review_count || 0,
    avgRating: profile.avg_rating ?? null,
  };
}

async function fetchProfileForSession(session) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;

  // Profile may not exist yet for a split second right after signup
  // (the trigger runs async) — fall back to auth metadata so the UI
  // doesn't flash empty.
  const meta = session.user.user_metadata || {};

  return {
    id: session.user.id,
    email: session.user.email,
    username: profile?.username || meta.username || "",
    name: profile?.name || meta.name || "",
    dob: profile?.dob || meta.dob || "",
    dobPublic: !!profile?.dob_public,
    contactMethod: profile?.contact_method || null,
    contactValue: profile?.contact_value || null,
    contactPublic: !!profile?.contact_public,
    restricted: profile?.restricted || false,
    reportCount: profile?.report_count || 0,
    createdAt: profile?.created_at ? new Date(profile.created_at).getTime() : Date.now(),
  };
}
