import { supabase } from "./supabaseClient.js";

/**
 * Friends, the feed, and likes/comments (shared between feed posts
 * and listings). All visibility rules (who can see a friends-only
 * post, who can like/comment on it) are enforced by RLS policies in
 * supabase/schema.sql — this file just calls the tables/views.
 */

async function currentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/* ---------------------------------------------------------- FRIENDS */

export async function sendFriendRequest(username) {
  const session = await currentSession();
  if (!session) throw new Error("You need to be logged in to add friends.");
  const meta = session.user.user_metadata || {};
  const uname = username.trim().toLowerCase();

  const { data: target, error: findErr } = await supabase
    .from("public_profiles")
    .select("id, username")
    .eq("username", uname)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!target) throw new Error("Couldn't find that HunT ID.");
  if (target.id === session.user.id) throw new Error("You can't friend yourself.");

  const { error } = await supabase.from("friendships").insert({
    requester_id: session.user.id,
    addressee_id: target.id,
    requester_username: (meta.username || "").toLowerCase(),
    addressee_username: target.username,
  });
  if (error) {
    if (error.code === "23505") throw new Error("You're already friends or have a pending request with them.");
    throw error;
  }
}

export async function respondFriendRequest(friendshipId, accept) {
  if (accept) {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
  }
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

export async function getFriendState() {
  const session = await currentSession();
  if (!session) return { friends: [], incoming: [], outgoing: [] };
  const me = session.user.id;

  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, requester_username, addressee_username, status")
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  if (error) throw error;

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const f of data || []) {
    const iAmRequester = f.requester_id === me;
    const otherUsername = iAmRequester ? f.addressee_username : f.requester_username;
    if (f.status === "accepted") {
      friends.push({ id: f.id, username: otherUsername });
    } else if (f.addressee_id === me) {
      incoming.push({ id: f.id, username: otherUsername });
    } else {
      outgoing.push({ id: f.id, username: otherUsername });
    }
  }
  return { friends, incoming, outgoing };
}

/* ---------------------------------------------------------- FEED POSTS */

export async function createPost({ text, photos, video, visibility }) {
  const session = await currentSession();
  if (!session) throw new Error("You need to be logged in to post.");
  const meta = session.user.user_metadata || {};
  const { error } = await supabase.from("feed_posts").insert({
    author_id: session.user.id,
    author_username: (meta.username || "").toLowerCase(),
    text: text?.trim() || null,
    photos: photos || [],
    video_url: video || null,
    visibility: visibility || "public",
  });
  if (error) throw error;
}

export async function deletePost(id) {
  const { error } = await supabase.from("feed_posts").delete().eq("id", id);
  if (error) throw error;
}

const FEED_PAGE_SIZE = 20;

export async function getFeed({ username, before } = {}) {
  let query = supabase.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(FEED_PAGE_SIZE);
  if (username) query = query.eq("author_username", username.trim().toLowerCase());
  // Cursor-based pagination: "before" is the created_at of the last post
  // already loaded, so each page picks up strictly older posts. This is
  // safer than offset-based paging since new posts arriving between
  // fetches won't shift results and cause duplicates/skips.
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  const posts = (data || []).map((p) => ({
    id: p.id,
    authorUsername: p.author_username,
    text: p.text,
    photos: p.photos || [],
    video: p.video_url || null,
    visibility: p.visibility,
    createdAt: new Date(p.created_at).getTime(),
    createdAtIso: p.created_at,
  }));
  return { posts, hasMore: posts.length === FEED_PAGE_SIZE };
}

/* ---------------------------------------------------------- AVATARS (batch, for feed authors) */

export async function getAvatarsForUsernames(usernames) {
  const unique = [...new Set(usernames)].filter(Boolean);
  if (!unique.length) return {};
  const { data, error } = await supabase.from("public_profiles").select("username, avatar_url").in("username", unique);
  if (error) throw error;
  const out = {};
  for (const row of data || []) out[row.username] = row.avatar_url || null;
  return out;
}

/* ---------------------------------------------------------- LIKES */

export async function toggleLike(targetType, targetId) {
  const session = await currentSession();
  if (!session) throw new Error("You need to be logged in to like this.");
  const meta = session.user.user_metadata || {};

  const { data: existing, error: findErr } = await supabase
    .from("likes")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { error } = await supabase.from("likes").delete().eq("id", existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("likes").insert({
    target_type: targetType,
    target_id: targetId,
    user_id: session.user.id,
    username: (meta.username || "").toLowerCase(),
  });
  if (error) throw error;
  return true;
}

export async function getLikeSummary(targetType, targetIds) {
  const ids = [...new Set(targetIds)].filter(Boolean);
  const out = {};
  for (const id of ids) out[id] = { count: 0, likedByMe: false };
  if (!ids.length) return out;

  const session = await currentSession();
  const { data, error } = await supabase
    .from("likes")
    .select("target_id, user_id")
    .eq("target_type", targetType)
    .in("target_id", ids);
  if (error) throw error;

  for (const row of data || []) {
    if (!out[row.target_id]) continue;
    out[row.target_id].count++;
    if (session && row.user_id === session.user.id) out[row.target_id].likedByMe = true;
  }
  return out;
}

/* ---------------------------------------------------------- ACTIVITY (likes/comments on things you own, for notifications) */

export async function getActivitySince({ targetType, targetIds, sinceIso, excludeUsername }) {
  if (!targetIds?.length) return { likes: [], comments: [] };

  const [likesRes, commentsRes] = await Promise.all([
    supabase
      .from("likes")
      .select("id, target_id, username, created_at")
      .eq("target_type", targetType)
      .in("target_id", targetIds)
      .gt("created_at", sinceIso),
    supabase
      .from("comments")
      .select("id, target_id, author_username, text, created_at")
      .eq("target_type", targetType)
      .in("target_id", targetIds)
      .gt("created_at", sinceIso),
  ]);
  if (likesRes.error) throw likesRes.error;
  if (commentsRes.error) throw commentsRes.error;

  return {
    likes: (likesRes.data || []).filter((l) => l.username !== excludeUsername),
    comments: (commentsRes.data || []).filter((c) => c.author_username !== excludeUsername),
  };
}

export async function getComments(targetType, targetId) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, author_username, text, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id,
    authorUsername: c.author_username,
    text: c.text,
    createdAt: new Date(c.created_at).getTime(),
  }));
}

export async function addComment(targetType, targetId, text) {
  const session = await currentSession();
  if (!session) throw new Error("You need to be logged in to comment.");
  const meta = session.user.user_metadata || {};
  const { error } = await supabase.from("comments").insert({
    target_type: targetType,
    target_id: targetId,
    author_id: session.user.id,
    author_username: (meta.username || "").toLowerCase(),
    text: text.trim(),
  });
  if (error) throw error;
}

export async function deleteComment(id) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}

export async function getCommentCounts(targetType, targetIds) {
  const ids = [...new Set(targetIds)].filter(Boolean);
  const out = {};
  for (const id of ids) out[id] = 0;
  if (!ids.length) return out;

  const { data, error } = await supabase
    .from("comments")
    .select("target_id")
    .eq("target_type", targetType)
    .in("target_id", ids);
  if (error) throw error;
  for (const row of data || []) {
    if (row.target_id in out) out[row.target_id]++;
  }
  return out;
}
