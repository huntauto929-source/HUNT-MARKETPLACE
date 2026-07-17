/**
 * Message notifications: desktop/OS notifications for new chats via
 * the browser Notification API, plus lightweight per-conversation
 * "last read" / "last notified" tracking in localStorage so we know
 * what's unread and don't re-notify the same message twice.
 *
 * This is scoped to the current browser (not synced across devices),
 * which is normal for this kind of read-state and keeps things simple
 * — no schema changes needed to add it.
 */

const READ_PREFIX = "hunt:lastread:";
const NOTIFIED_PREFIX = "hunt:lastnotified:";

function convoKey(prefix, me, other) {
  return `${prefix}${me}:${other}`;
}

export function getLastRead(me, other) {
  const v = localStorage.getItem(convoKey(READ_PREFIX, me, other));
  return v ? Number(v) : 0;
}

export function setLastRead(me, other, ts) {
  try { localStorage.setItem(convoKey(READ_PREFIX, me, other), String(ts)); } catch (_) { /* ignore */ }
}

function getLastNotified(me, other) {
  const v = localStorage.getItem(convoKey(NOTIFIED_PREFIX, me, other));
  return v ? Number(v) : 0;
}

function setLastNotified(me, other, ts) {
  try { localStorage.setItem(convoKey(NOTIFIED_PREFIX, me, other), String(ts)); } catch (_) { /* ignore */ }
}

const ACTIVITY_SEEN_PREFIX = "hunt:activity:lastseen:";

export function getActivityWatermark(me) {
  const v = localStorage.getItem(`${ACTIVITY_SEEN_PREFIX}${me}`);
  return v ? Number(v) : Date.now(); // first run: don't notify about old history
}

export function setActivityWatermark(me, ts) {
  try { localStorage.setItem(`${ACTIVITY_SEEN_PREFIX}${me}`, String(ts)); } catch (_) { /* ignore */ }
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch (_) {
    return "denied";
  }
}

export function showMessageNotification({ from, text, onClick }) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(`New message from @${from}`, {
      body: text && text.length > 120 ? `${text.slice(0, 117)}...` : text || "",
      tag: `hunt-chat-${from}`, // collapses stacked notifications from the same sender
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch (_) {
    // Notification constructor can throw in some contexts; never let
    // a notification failure break the app.
  }
}

export function showActivityNotification({ type, kind, actor, title, text }) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const verb = type === "like" ? "liked" : "commented on";
  const subject = kind === "listing" ? `your listing "${title || "listing"}"` : "your post";
  const body = type === "comment" && text ? (text.length > 100 ? `${text.slice(0, 97)}...` : text) : undefined;
  try {
    const n = new Notification(`@${actor} ${verb} ${subject}`, {
      body,
      tag: `hunt-activity-${kind}-${actor}-${type}`,
    });
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent("hunt:open-profile"));
      n.close();
    };
  } catch (_) {
    // never let a notification failure break the app
  }
}

/**
 * Given a conversation's message array, decide whether the latest
 * message from someone else is new enough to notify about, and mark
 * it notified if so. Returns true if a notification was shown.
 */
export function maybeNotifyNewMessage({ me, other, messages, isConversationActive }) {
  if (!messages?.length) return false;
  const last = messages[messages.length - 1];
  if (last.from === me) return false;

  const lastRead = getLastRead(me, other);
  const lastNotified = getLastNotified(me, other);
  if (last.ts <= lastRead || last.ts <= lastNotified) return false;
  if (isConversationActive) return false; // already looking at it — no need to interrupt

  showMessageNotification({
    from: last.from,
    text: last.text,
    onClick: () => window.dispatchEvent(new CustomEvent("hunt:open-chat", { detail: other })),
  });
  setLastNotified(me, other, last.ts);
  return true;
}
