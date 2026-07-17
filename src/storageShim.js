import { supabase } from "./supabaseClient.js";

// This mirrors the get/set/list/delete shape the app already uses
// (Claude's demo `window.storage` API), backed by a real Postgres
// table instead. Every call in the app passes shared=true, so this
// shim only implements the public/shared namespace.

async function get(key) {
  const { data, error } = await supabase
    .from("kv_store")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Key not found: ${key}`);
  return { key, value: data.value, shared: true };
}

async function set(key, value) {
  const { error } = await supabase
    .from("kv_store")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw error;
  return { key, value, shared: true };
}

async function del(key) {
  const { error } = await supabase.from("kv_store").delete().eq("key", key);
  if (error) throw error;
  return { key, deleted: true, shared: true };
}

async function list(prefix) {
  let query = supabase.from("kv_store").select("key");
  if (prefix) query = query.like("key", `${prefix}%`);
  const { data, error } = await query;
  if (error) throw error;
  return { keys: (data || []).map((r) => r.key), prefix, shared: true };
}

export function installStorageShim() {
  window.storage = { get, set, delete: del, list };
}
